import { C } from '../../../styles/colors';
import { useApp } from '../../../context/AppContext';
import { useBreakpoint } from '../../../hooks/useBreakpoint';
import { tr, type L10n, type LandingContent, type LandingSectionKey } from '../../../api/landing';
import { LIST_LIMITS } from '../../../validations/landingValidation';
import { PLATFORM_ICON_OPTIONS, SOCIAL_OPTIONS, socialLabel } from '../../landing/landingIcons';
import {
  FieldGroup, HrefInput, IconPicker, L10nInput, LinkInput, ListEditor, SelectInput, TextInput, fieldStyle, labelStyle,
} from './LandingFields';

// Form chỉnh sửa từng section Landing (một tab một section). Chỉ dựng UI — lưu/xuất bản ở trang
// pages/admin/Landing.tsx. Mọi cập nhật bất biến (tạo object mới) để so sánh "chưa lưu".

const empty = (): L10n => ({ vi: '', en: '' });

interface EditorProps<K extends LandingSectionKey> {
  value: LandingContent[K];
  onChange: (v: LandingContent[K]) => void;
  errors: Set<string>;
}

export default function LandingSectionEditor<K extends LandingSectionKey>({ sectionKey, ...rest }: EditorProps<K> & { sectionKey: K }) {
  const props = rest as unknown as EditorProps<LandingSectionKey>;
  switch (sectionKey) {
    case 'hero': return <HeroEditor {...(props as EditorProps<'hero'>)} />;
    case 'features': return <FeaturesEditor {...(props as EditorProps<'features'>)} />;
    case 'how_it_works': return <HowItWorksEditor {...(props as EditorProps<'how_it_works'>)} />;
    case 'integrations': return <IntegrationsEditor {...(props as EditorProps<'integrations'>)} />;
    case 'cta': return <CtaEditor {...(props as EditorProps<'cta'>)} />;
    case 'faq': return <FaqEditor {...(props as EditorProps<'faq'>)} />;
    case 'footer': return <FooterEditor {...(props as EditorProps<'footer'>)} />;
    default: return null;
  }
}

function TwoCol({ children }: { children: React.ReactNode }) {
  const { isMobile } = useBreakpoint();
  return <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 14 }}>{children}</div>;
}

function HeroEditor({ value: v, onChange, errors }: EditorProps<'hero'>) {
  const { t, lang } = useApp();
  const set = <F extends keyof typeof v>(f: F, x: (typeof v)[F]) => onChange({ ...v, [f]: x });
  return (
    <>
      <L10nInput label={t.lpFBadge} value={v.badge} onChange={(x) => set('badge', x)} path="badge" errors={errors} />
      <L10nInput label={t.lpFTitleLine1} value={v.titleLine1} onChange={(x) => set('titleLine1', x)} path="titleLine1" errors={errors} />
      <L10nInput label={t.lpFTitleHighlight} value={v.titleHighlight} onChange={(x) => set('titleHighlight', x)} path="titleHighlight" errors={errors} />
      <L10nInput label={t.lpFSubtitle} value={v.subtitle} onChange={(x) => set('subtitle', x)} path="subtitle" errors={errors} multiline />
      <TwoCol>
        <LinkInput label={t.lpFPrimaryCta} value={v.primaryCta} onChange={(x) => set('primaryCta', x)} path="primaryCta" errors={errors} />
        <LinkInput label={t.lpFSecondaryCta} value={v.secondaryCta} onChange={(x) => set('secondaryCta', x)} path="secondaryCta" errors={errors} />
      </TwoCol>
      <ListEditor
        title={t.lpFStats}
        items={v.stats}
        onChange={(x) => set('stats', x)}
        create={() => ({ value: 0, suffix: '', label: empty() })}
        itemTitle={(s) => `${s.value}${s.suffix} · ${tr(s.label, lang)}`}
        limits={LIST_LIMITS.stats}
        path="stats"
        errors={errors}
        render={(s, update, i) => (
          <>
            <TwoCol>
              <label style={{ display: 'block' }}>
                <span style={labelStyle}>{t.lpFStatValue}</span>
                <input
                  type="number"
                  min={0}
                  step="any"
                  value={Number.isFinite(s.value) ? s.value : ''}
                  onChange={(e) => update({ ...s, value: e.target.value === '' ? NaN : Number(e.target.value) })}
                  aria-invalid={errors.has(`stats.${i}.value`)}
                  style={errors.has(`stats.${i}.value`) ? { ...fieldStyle, borderColor: C.legacyBordere25c84 } : fieldStyle}
                />
              </label>
              <TextInput label={t.lpFStatSuffix} value={s.suffix} onChange={(x) => update({ ...s, suffix: x })} path={`stats.${i}.suffix`} errors={errors} placeholder="+ · /7 · ×" />
            </TwoCol>
            <L10nInput label={t.lpFStatLabel} value={s.label} onChange={(x) => update({ ...s, label: x })} path={`stats.${i}.label`} errors={errors} />
          </>
        )}
      />
    </>
  );
}

function FeaturesEditor({ value: v, onChange, errors }: EditorProps<'features'>) {
  const { t, lang } = useApp();
  return (
    <>
      <L10nInput label={t.lpFTitle} value={v.title} onChange={(x) => onChange({ ...v, title: x })} path="title" errors={errors} />
      <L10nInput label={t.lpFSubtitle} value={v.subtitle} onChange={(x) => onChange({ ...v, subtitle: x })} path="subtitle" errors={errors} />
      <ListEditor
        title={t.lpFCards}
        items={v.items}
        onChange={(x) => onChange({ ...v, items: x })}
        create={() => ({ icon: 'sparkles', title: empty(), description: empty() })}
        itemTitle={(it) => tr(it.title, lang)}
        limits={LIST_LIMITS.featureItems}
        path="items"
        errors={errors}
        render={(it, update, i) => (
          <>
            <IconPicker value={it.icon} onChange={(x) => update({ ...it, icon: x })} path={`items.${i}.icon`} errors={errors} />
            <L10nInput label={t.lpFTitle} value={it.title} onChange={(x) => update({ ...it, title: x })} path={`items.${i}.title`} errors={errors} />
            <L10nInput label={t.lpFDescription} value={it.description} onChange={(x) => update({ ...it, description: x })} path={`items.${i}.description`} errors={errors} multiline />
          </>
        )}
      />
    </>
  );
}

function HowItWorksEditor({ value: v, onChange, errors }: EditorProps<'how_it_works'>) {
  const { t, lang } = useApp();
  return (
    <>
      <L10nInput label={t.lpFTitle} value={v.title} onChange={(x) => onChange({ ...v, title: x })} path="title" errors={errors} />
      <L10nInput label={t.lpFSubtitle} value={v.subtitle} onChange={(x) => onChange({ ...v, subtitle: x })} path="subtitle" errors={errors} />
      <FieldGroup hint={t.lpFStepHint}>
        <ListEditor
          title={t.lpFSteps}
          items={v.steps}
          onChange={(x) => onChange({ ...v, steps: x })}
          create={() => ({ title: empty(), description: empty() })}
          itemTitle={(s) => tr(s.title, lang)}
          limits={LIST_LIMITS.steps}
          path="steps"
          errors={errors}
          render={(s, update, i) => (
            <>
              <L10nInput label={t.lpFTitle} value={s.title} onChange={(x) => update({ ...s, title: x })} path={`steps.${i}.title`} errors={errors} />
              <L10nInput label={t.lpFDescription} value={s.description} onChange={(x) => update({ ...s, description: x })} path={`steps.${i}.description`} errors={errors} multiline />
            </>
          )}
        />
      </FieldGroup>
    </>
  );
}

function IntegrationsEditor({ value: v, onChange, errors }: EditorProps<'integrations'>) {
  const { t } = useApp();
  const iconOptions = [{ value: '', label: t.lpFNoIcon }, ...PLATFORM_ICON_OPTIONS.map((o) => ({ value: o.key, label: o.label }))];
  return (
    <>
      <L10nInput label={t.lpFIntro} value={v.title} onChange={(x) => onChange({ ...v, title: x })} path="title" errors={errors} />
      <ListEditor
        title={t.lpFPlatforms}
        items={v.platforms}
        onChange={(x) => onChange({ ...v, platforms: x })}
        create={() => ({ name: '', icon: 'globe', logoUrl: null })}
        itemTitle={(p) => p.name}
        limits={LIST_LIMITS.platforms}
        path="platforms"
        errors={errors}
        render={(p, update, i) => (
          <>
            <TwoCol>
              <TextInput label={t.lpFPlatformName} value={p.name} onChange={(x) => update({ ...p, name: x })} path={`platforms.${i}.name`} errors={errors} />
              <SelectInput label={t.lpFPresetIcon} value={p.icon ?? ''} onChange={(x) => update({ ...p, icon: x || null })} options={iconOptions} />
            </TwoCol>
            <TextInput label={t.lpFLogoUrl} value={p.logoUrl ?? ''} onChange={(x) => update({ ...p, logoUrl: x || null })} path={`platforms.${i}.logoUrl`} errors={errors} placeholder="https://…/logo.png" hint={t.lpFLogoHint} />
          </>
        )}
      />
    </>
  );
}

function CtaEditor({ value: v, onChange, errors }: EditorProps<'cta'>) {
  const { t, lang } = useApp();
  const set = <F extends keyof typeof v>(f: F, x: (typeof v)[F]) => onChange({ ...v, [f]: x });
  return (
    <>
      <L10nInput label={t.lpFBadge} value={v.badge} onChange={(x) => set('badge', x)} path="badge" errors={errors} />
      <L10nInput label={t.lpFTitle} value={v.title} onChange={(x) => set('title', x)} path="title" errors={errors} />
      <L10nInput label={t.lpFSubtitle} value={v.subtitle} onChange={(x) => set('subtitle', x)} path="subtitle" errors={errors} multiline />
      <TwoCol>
        <LinkInput label={t.lpFPrimaryCta} value={v.primaryCta} onChange={(x) => set('primaryCta', x)} path="primaryCta" errors={errors} />
        <LinkInput label={t.lpFSecondaryCta} value={v.secondaryCta} onChange={(x) => set('secondaryCta', x)} path="secondaryCta" errors={errors} />
      </TwoCol>
      <ListEditor
        title={t.lpFChecks}
        items={v.checks}
        onChange={(x) => set('checks', x)}
        create={empty}
        itemTitle={(c) => tr(c, lang)}
        limits={LIST_LIMITS.checks}
        path="checks"
        errors={errors}
        render={(c, update, i) => <L10nInput label={t.lpFLinkText} value={c} onChange={update} path={`checks.${i}`} errors={errors} />}
      />
    </>
  );
}

function FaqEditor({ value: v, onChange, errors }: EditorProps<'faq'>) {
  const { t, lang } = useApp();
  return (
    <>
      <L10nInput label={t.lpFTitle} value={v.title} onChange={(x) => onChange({ ...v, title: x })} path="title" errors={errors} />
      <L10nInput label={t.lpFSubtitle} value={v.subtitle} onChange={(x) => onChange({ ...v, subtitle: x })} path="subtitle" errors={errors} />
      <ListEditor
        title={t.lpFQuestions}
        items={v.items}
        onChange={(x) => onChange({ ...v, items: x })}
        create={() => ({ question: empty(), answer: empty() })}
        itemTitle={(it) => tr(it.question, lang)}
        limits={LIST_LIMITS.faqItems}
        path="items"
        errors={errors}
        render={(it, update, i) => (
          <>
            <L10nInput label={t.lpFQuestion} value={it.question} onChange={(x) => update({ ...it, question: x })} path={`items.${i}.question`} errors={errors} />
            <L10nInput label={t.lpFAnswer} value={it.answer} onChange={(x) => update({ ...it, answer: x })} path={`items.${i}.answer`} errors={errors} multiline />
          </>
        )}
      />
    </>
  );
}

function FooterEditor({ value: v, onChange, errors }: EditorProps<'footer'>) {
  const { t, lang } = useApp();
  const set = <F extends keyof typeof v>(f: F, x: (typeof v)[F]) => onChange({ ...v, [f]: x });
  const socialOptions = SOCIAL_OPTIONS.map((o) => ({ value: o.key, label: o.label }));
  return (
    <>
      <L10nInput label={t.lpFCompanyDesc} value={v.description} onChange={(x) => set('description', x)} path="description" errors={errors} multiline />
      <TextInput label={t.lpFEmail} type="email" value={v.email} onChange={(x) => set('email', x)} path="email" errors={errors} placeholder="hello@company.com" />
      <ListEditor
        title={t.lpFSocials}
        items={v.socials}
        onChange={(x) => set('socials', x)}
        create={() => ({ platform: 'facebook', url: '' })}
        itemTitle={(s) => socialLabel(s.platform)}
        limits={LIST_LIMITS.socials}
        path="socials"
        errors={errors}
        render={(s, update, i) => (
          <TwoCol>
            <SelectInput label={t.lpFSocialPlatform} value={s.platform} onChange={(x) => update({ ...s, platform: x })} options={socialOptions} />
            <TextInput label={t.lpFUrl} value={s.url} onChange={(x) => update({ ...s, url: x })} path={`socials.${i}.url`} errors={errors} placeholder="https://…" />
          </TwoCol>
        )}
      />
      <ListEditor
        title={t.lpFColumns}
        items={v.columns}
        onChange={(x) => set('columns', x)}
        create={() => ({ title: empty(), links: [] })}
        itemTitle={(c) => tr(c.title, lang)}
        limits={LIST_LIMITS.columns}
        path="columns"
        errors={errors}
        render={(col, update, ci) => (
          <>
            <L10nInput label={t.lpFColumnTitle} value={col.title} onChange={(x) => update({ ...col, title: x })} path={`columns.${ci}.title`} errors={errors} />
            <ListEditor
              title={t.lpFLinks}
              items={col.links}
              onChange={(x) => update({ ...col, links: x })}
              create={() => ({ label: empty(), href: '' })}
              itemTitle={(ln) => tr(ln.label, lang)}
              limits={LIST_LIMITS.links}
              path={`columns.${ci}.links`}
              errors={errors}
              render={(ln, updateLink, li) => (
                <>
                  <L10nInput label={t.lpFLinkText} value={ln.label} onChange={(x) => updateLink({ ...ln, label: x })} path={`columns.${ci}.links.${li}.label`} errors={errors} />
                  <HrefInput label={t.lpFLink} value={ln.href} onChange={(x) => updateLink({ ...ln, href: x })} path={`columns.${ci}.links.${li}.href`} errors={errors} placeholder="/pricing" hint={`${t.lpFLinkHint} ${t.lpFFooterLinkHint}`} />
                </>
              )}
            />
          </>
        )}
      />
      <L10nInput label={t.lpFNewsletter} value={v.newsletterText} onChange={(x) => set('newsletterText', x)} path="newsletterText" errors={errors} multiline />
    </>
  );
}
