import { DetailBar } from '../components/ui';
import ClusterManager from '../components/ClusterManager';

export default function ClustersScreen({ back, flash }: { back: () => void; flash: (m: string) => void }) {
  return (
    <>
      <DetailBar title="Themen-Cluster" back={back} />
      <ClusterManager flash={flash} />
    </>
  );
}
