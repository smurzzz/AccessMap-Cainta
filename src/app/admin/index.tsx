import { Redirect } from 'expo-router';

/** `/admin` now lands on the tabbed console (Directory / Audit / Analytics / Settings). */
export default function AdminIndex() {
  return <Redirect href="/admin/tabs" />;
}
