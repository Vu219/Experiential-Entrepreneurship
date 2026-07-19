import { useNavigate } from 'react-router-dom';
import PageContainer from '../../components/PageContainer.tsx';
import ContentList from '../../components/create/ContentList.tsx';

/**
 * /create — lớp 1 của tab Tạo nội dung: danh sách nội dung đã tạo (list-first,
 * cùng pattern trang Thương hiệu). Nút "Tạo nội dung" mở wizard ở TRANG RIÊNG
 * (/create/new); bản nháp dở dang "Tiếp tục" cũng vào wizard kèm draftId.
 */
export default function Create() {
  const navigate = useNavigate();

  return (
    <PageContainer>
      <ContentList
        onCreate={() => navigate('/create/new')}
        onContinue={(item) => navigate('/create/new', { state: { draftId: item.id } })}
      />
    </PageContainer>
  );
}
