import { Link } from 'react-router';
import { EmptyState } from '../components/EmptyState';

export default function NotFound({ what = 'page' }: { what?: string }) {
  return (
    <EmptyState
      icon="🔎"
      title={`That ${what} does not exist`}
      body="It may have been deleted on this device."
      actions={
        <Link to="/" className="btn btn-primary">
          Back to sessions
        </Link>
      }
    />
  );
}
