import { useNavigate } from 'react-router-dom';
import PageContainer from '../../components/PageContainer.tsx';
import ContentList from '../../components/create/ContentList.tsx';

/**
 * /create — lớp 1 của tab Tạo nội dung: danh sách nội dung đã tạo (list-first,
 * cùng pattern trang Thương hiệu). Nút "Tạo nội dung" mở wizard ở TRANG RIÊNG
 * (/create/new); bản nháp dở dang "Tiếp tục" vào /create/:id (đúng bước đã lưu), "Lên lịch" vào
 * /create/:id?step=4 (chế độ chỉ lên lịch khi bài đã rời wizard).
 */
export default function Create() {
  const navigate = useNavigate();

  return (
    <PageContainer>
      <ContentList
        onCreate={() => navigate('/create/new')}
        onContinue={(item) => navigate(`/create/${item.id}`)}
        onSchedule={(item) => navigate(`/create/${item.id}?step=4`)}
      />
    </PageContainer>
  );
}
