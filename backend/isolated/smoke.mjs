import {execFileSync} from 'node:child_process';
import {randomUUID,randomBytes,createCipheriv} from 'node:crypto';
import assert from 'node:assert/strict';
const base='http://127.0.0.1:8092/api/aima';
const sql=s=>execFileSync('docker',['compose','-f','backend/isolated/compose.yml','exec','-T','postgres','psql','-U','aima_isolated','-d','aima_isolated','-v','ON_ERROR_STOP=1','-At'],{input:s,encoding:'utf8'}).trim();
const health=await fetch(base+'/actuator/health'); assert.equal(health.status,200);
const login=await fetch(base+'/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:'admin@gmail.com',password:'Admin123'})});
const auth=await login.json(); assert.ok(auth.result?.token,'Local login failed');
const request=async(path,method='GET',body)=>{const r=await fetch(base+path,{method,headers:{Authorization:'Bearer '+auth.result.token,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});return {status:r.status,body:await r.json()};};
const user=sql("select id from users where email='admin@gmail.com';"); assert.match(user,/^[\da-f-]{36}$/);
const [brand,item,version,account]=Array.from({length:4},randomUUID);
const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',Buffer.from('0123456789abcdef0123456789abcdef'),iv);
const token=Buffer.concat([iv,cipher.update('isolated-fake-token'),cipher.final(),cipher.getAuthTag()]).toString('base64');
sql(`BEGIN;
insert into brand_profiles(id,created_at,user_id,brand_name,industry,target_audience,is_active) values ('${brand}',now(),'${user}','Phase0 smoke','test','test',true);
insert into content_items(id,created_at,brand_profile_id,status) values ('${item}',now(),'${brand}','FORMATTED');
insert into content_versions(id,created_at,content_item_id,platform_name,status) values ('${version}',now(),'${item}','FACEBOOK','FORMATTED');
insert into platform_accounts(id,created_at,user_id,platform_name,connection_status,account_type,token_type,platform_account_id,account_name,access_token) values ('${account}',now(),'${user}','FACEBOOK','ACTIVE','PAGE','PAGE_TOKEN','${account}','Phase0 fake page','${token}'); COMMIT;`);
const settings=await request('/users/me/publishing-settings');assert.equal(settings.body.result.timezone,'Asia/Ho_Chi_Minh');
const input={contentVersionId:version,platformAccountId:account,scheduledTime:'2030-10-01T00:30:00+07:00'};
const created=await request('/schedules','POST',input);assert.equal(created.status,200,JSON.stringify(created));assert.equal(created.body.result.scheduledTime,'2030-09-30T17:30:00Z');
const id=created.body.result.id;assert.ok(id);
// Phase 1: trạng thái tổng suy ra từ lịch; duyệt là chiều riêng, gửi lặp = no-op; lọc PG theo reviewStatus.
const itemOf=async()=>(await request('/content-items/'+item)).body.result;
let detail=await itemOf();assert.equal(detail.status,'SCHEDULED');assert.equal(detail.reviewStatus,'NONE');assert.equal(detail.versions[0].status,'FORMATTED');assert.equal(detail.versions[0].scheduleStatus,'SCHEDULED');
for(const target of ['NEED_REVIEW','NEED_REVIEW','APPROVED']){const r=await request('/content-items/'+item+'/review','PATCH',{reviewStatus:target});assert.equal(r.status,200,JSON.stringify(r));assert.equal(r.body.result.reviewStatus,target);assert.equal(r.body.result.status,'SCHEDULED');}
const badReview=await request('/content-items/'+item+'/review','PATCH',{reviewStatus:'CHANGES_REQUESTED'});assert.equal(badReview.status,400);assert.equal(badReview.body.code,1922);
const approvedList=await request('/content-items?reviewStatus=APPROVED&status=SCHEDULED&size=50');assert.equal(approvedList.status,200,JSON.stringify(approvedList));assert.ok(approvedList.body.result.content.some(i=>i.id===item));
const noneList=await request('/content-items?reviewStatus=NONE&size=50');assert.ok(!noneList.body.result.content.some(i=>i.id===item));
const updated=await request('/schedules/'+id,'PUT',{scheduledTime:'2030-10-02T00:30:00+07:00'});assert.equal(updated.body.result.scheduledTime,'2030-10-01T17:30:00Z');
for(const time of ['2020-01-01T00:00:00Z','2030-10-02T00:30:00']) {const invalid=await request('/schedules/'+id,'PUT',{scheduledTime:time});assert.ok(invalid.status>=400 && invalid.status<500,JSON.stringify(invalid));}
const cancelled=await request('/schedules/'+id,'DELETE');assert.equal(cancelled.body.result.status,'CANCELLED');
detail=await itemOf();assert.equal(detail.status,'FORMATTED');assert.equal(detail.reviewStatus,'APPROVED','hủy lịch không mất duyệt');assert.equal(detail.versions[0].scheduleStatus??null,null);
assert.equal(sql(`select count(*) from posts where schedule_id='${id}';`),'0');
// Phase 2: bắt buộc duyệt giữ lịch (PENDING_REVIEW) tới khi duyệt; sửa bài đã duyệt → duyệt lại; IG bị chặn ở BE.
const policy=async(requireApproval)=>{const r=await request('/users/me/publishing-settings','PUT',{timezone:'Asia/Ho_Chi_Minh',requireApproval,conflictWindowMinutes:60,brandVoiceBlockingEnabled:false,brandVoiceThreshold:null});assert.equal(r.status,200,JSON.stringify(r));return r.body.result;};
try {
  assert.equal((await policy(true)).requireApproval,true);
  const edited=await request('/content-items/'+item+'/versions/'+version,'PUT',{caption:'Phase 2 smoke '+randomUUID()});assert.equal(edited.status,200,JSON.stringify(edited));assert.equal(edited.body.result.reviewStatus,'NEED_REVIEW','sửa bài đã duyệt → duyệt lại');
  const held=await request('/schedules','POST',{...input,scheduledTime:'2030-10-03T09:00:00+07:00'});assert.equal(held.status,200,JSON.stringify(held));
  assert.equal(held.body.result.status,'ON_HOLD');assert.deepEqual(held.body.result.holdReasons,['PENDING_REVIEW']);
  const approved=await request('/content-items/'+item+'/review','PATCH',{reviewStatus:'APPROVED'});assert.equal(approved.body.result.status,'SCHEDULED');
  const resumed=await request('/schedules/'+held.body.result.id);assert.equal(resumed.body.result.status,'SCHEDULED');assert.deepEqual(resumed.body.result.holdReasons,[]);
  assert.equal((await request('/schedules/'+held.body.result.id,'DELETE')).body.result.status,'CANCELLED');
} finally { await policy(false); }
const [igItem,igVersion,igAccount]=Array.from({length:3},randomUUID);
sql(`BEGIN;
insert into content_items(id,created_at,brand_profile_id,status) values ('${igItem}',now(),'${brand}','FORMATTED');
insert into content_versions(id,created_at,content_item_id,platform_name,status) values ('${igVersion}',now(),'${igItem}','INSTAGRAM','FORMATTED');
insert into platform_accounts(id,created_at,user_id,platform_name,connection_status,account_type,token_type,platform_account_id,account_name,access_token) values ('${igAccount}',now(),'${user}','INSTAGRAM','ACTIVE','BUSINESS_ACCOUNT','PAGE_TOKEN','${igAccount}','Phase2 fake IG','${token}'); COMMIT;`);
const ig=await request('/schedules','POST',{contentVersionId:igVersion,platformAccountId:igAccount,scheduledTime:'2030-10-03T09:00:00+07:00'});assert.equal(ig.status,400);assert.equal(ig.body.code,2130);
// Phase 3: batch theo dòng + idempotency (gửi lại cùng key → cùng lịch), khung giờ gợi ý, đăng ngay → job (stub nhận, không ra ngoài).
const [bItem,bVersion]=Array.from({length:2},randomUUID);
sql(`insert into content_items(id,created_at,brand_profile_id,status) values ('${bItem}',now(),'${brand}','FORMATTED'); insert into content_versions(id,created_at,content_item_id,platform_name,status) values ('${bVersion}',now(),'${bItem}','FACEBOOK','FORMATTED');`);
const rows=[{clientRowId:'fb',idempotencyKey:'smoke-'+randomUUID(),contentVersionId:bVersion,platformAccountId:account,mode:'SCHEDULE',scheduledTime:'2030-10-04T20:00:00+07:00'},
  {clientRowId:'ig',idempotencyKey:'smoke-'+randomUUID(),contentVersionId:igVersion,platformAccountId:igAccount,mode:'SCHEDULE',scheduledTime:'2030-10-04T20:00:00+07:00'}];
const b1=await request('/schedules/batch','POST',{rows});assert.equal(b1.status,200,JSON.stringify(b1));assert.equal(b1.body.result.succeeded,1);
assert.equal(b1.body.result.rows.find(r=>r.clientRowId==='ig').code,2130);
const b2=await request('/schedules/batch','POST',{rows:[rows[0]]});assert.equal(b2.body.result.rows[0].schedule.id,b1.body.result.rows.find(r=>r.clientRowId==='fb').schedule.id,'cùng key → cùng lịch');
const slots=await request('/schedules/suggested-slots?accountId='+account+'&count=3');assert.equal(slots.status,200,JSON.stringify(slots));assert.equal(slots.body.result.length,3);
const bSchedule=b1.body.result.rows.find(r=>r.clientRowId==='fb').schedule.id;
const now1=await request('/schedules/'+bSchedule+'/publish-now','POST');assert.equal(now1.status,200,JSON.stringify(now1));assert.ok(now1.body.result.jobId);assert.equal(now1.body.result.status,'POSTING');
assert.equal(sql(`select count(*) from posting_jobs j join posts p on p.id=j.post_id where p.schedule_id='${bSchedule}';`)>='1',true);
// Phase 6: job sửa trạng thái một lần — dry-run không ghi, apply đúng planToken, chạy lại rỗng, không tạo job đăng.
for(let i=0;i<40 && (await request('/schedules/'+bSchedule)).body.result.status==='POSTING';i++) await new Promise(r=>setTimeout(r,500));
const [rItem,rVersion,rIgItem,rIgVersion,rIgSchedule]=Array.from({length:5},randomUUID);
sql(`BEGIN;
insert into content_items(id,created_at,brand_profile_id,status,review_status) values ('${rItem}',now(),'${brand}','GENERATED','NEED_REVIEW');
insert into content_versions(id,created_at,content_item_id,platform_name,status) values ('${rVersion}',now(),'${rItem}','FACEBOOK','FORMATTED');
insert into content_items(id,created_at,brand_profile_id,status) values ('${rIgItem}',now(),'${brand}','SCHEDULED');
insert into content_versions(id,created_at,content_item_id,platform_name,status) values ('${rIgVersion}',now(),'${rIgItem}','INSTAGRAM','FORMATTED');
insert into post_schedules(id,created_at,content_version_id,platform_account_id,scheduled_time,status) values ('${rIgSchedule}',now(),'${rIgVersion}','${igAccount}','2030-10-05T09:00:00+07:00','SCHEDULED'); COMMIT;`);
const jobsBefore=sql('select count(*) from posting_jobs;'),analyticsBefore=sql('select count(*) from post_analytics;');
const dry=await request('/admin/maintenance/content-status-repair');assert.equal(dry.status,200,JSON.stringify(dry));
const plan=dry.body.result;assert.ok(plan.planToken);assert.equal(plan.flywayVersion,'5');
assert.deepEqual(plan.itemChanges.find(c=>c.itemId===rItem),{itemId:rItem,from:'GENERATED',to:'FORMATTED',reason:'FORMATTED/-'});
assert.ok(plan.instagramSchedules.includes(rIgSchedule));assert.ok(plan.enumUsage['post_schedules.status']);
assert.equal(sql(`select status from content_items where id='${rItem}';`),'GENERATED','dry-run không ghi');
const stale=await request('/admin/maintenance/content-status-repair','POST',{planToken:'0'.repeat(64)});assert.equal(stale.status,409);assert.equal(stale.body.code,2144);
const noToken=await request('/admin/maintenance/content-status-repair','POST',{});assert.equal(noToken.status,400);assert.equal(noToken.body.code,2145);
const applied=await request('/admin/maintenance/content-status-repair','POST',{planToken:plan.planToken});assert.equal(applied.status,200,JSON.stringify(applied));assert.equal(applied.body.result.remainingChanges,0);
assert.equal(sql(`select status||'/'||review_status from content_items where id='${rItem}';`),'FORMATTED/NEED_REVIEW','không tự duyệt');
assert.equal(sql(`select s.status||'/'||h.reason from post_schedules s join post_schedule_holds h on h.schedule_id=s.id where s.id='${rIgSchedule}';`),'ON_HOLD/UNSUPPORTED_MEDIA');
assert.equal(sql(`select status from content_items where id='${rIgItem}';`),'ON_HOLD');
const again=(await request('/admin/maintenance/content-status-repair')).body.result;assert.deepEqual(again.itemChanges,[]);assert.deepEqual(again.instagramSchedules,[]);
assert.equal(sql('select count(*) from posting_jobs;'),jobsBefore,'repair không tạo job đăng');assert.equal(sql('select count(*) from post_analytics;'),analyticsBefore);
console.log('PASS: isolated login, owned timezone, create offset->UTC, aggregate/review split, review no-op, PG list filter, reschedule, reject past/naive, cancel keeps approval, approval policy hold/resume, edit invalidates approval, IG blocked, batch rows + idempotent replay, suggested slots, publish-now job (stub only), status repair dry-run/apply/idempotent + IG hold.');
