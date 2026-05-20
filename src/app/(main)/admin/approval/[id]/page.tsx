import ActivityTimeline from "@/components/reports/ActivityTimeline";
import DetailApprovalView from "./_components/DetailApprovalView";

interface PropTypes {
  params: Promise<{ id: string }>;
}

export default async function DetailApproval(props: PropTypes) {
  const { params } = props;
  const { id } = await params;

  return (
    <div>
      <DetailApprovalView id={id} />
    </div>
  );
}
