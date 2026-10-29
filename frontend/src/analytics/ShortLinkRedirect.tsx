import { Navigate, useParams } from 'react-router-dom';
import { shortLinkTarget } from './shortLinks';

/** Route /go/:code — chuyển ngay (replace) sang trang chủ kèm UTM để GA4 ghi đúng nguồn của phiên. */
export default function ShortLinkRedirect() {
  const { code } = useParams();
  return <Navigate to={shortLinkTarget(code)} replace />;
}
