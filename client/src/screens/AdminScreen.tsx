import { DetailBar } from '../components/ui';
import AdminSections from '../components/AdminSections';

export default function AdminScreen({ back }: { back: () => void }) {
  return (
    <>
      <DetailBar title="Administration" back={back} />
      <div className="scroll" style={{ paddingBottom: 28, paddingTop: 8 }}>
        <AdminSections />
      </div>
    </>
  );
}
