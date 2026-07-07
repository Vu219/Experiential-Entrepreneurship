import { useNavigate } from 'react-router-dom';
import { useBreakpoint } from '../../hooks/useBreakpoint.ts';
import ContentList from '../../components/create/ContentList.tsx';

/**
 * /create — lớp 1 của tab Tạo nội dung: danh sách nội dung đã tạo (list-first,
 * cùng pattern trang Thương hiệu). Nút "Tạo nội dung" mở wizard ở TRANG RIÊNG
 * (/create/new); bản nháp dở dang "Tiếp tục" cũng vào wizard kèm draftId.
 */
export default function Create() {
  const { width } = useBreakpoint();
  const navigate = useNavigate();

  return (
    <div className="view-pop" style={{ maxWidth: width >= 1440 ? 1320 : 1180, margin: '0 auto' }}>
      <ContentList
        onCreate={() => navigate('/create/new')}
        onContinue={(item) => navigate('/create/new', { state: { draftId: item.id } })}
      />
    </div>
  );
}
