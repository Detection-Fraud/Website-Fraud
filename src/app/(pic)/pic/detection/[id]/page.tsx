import { auth } from "@/auth";
import { Card } from "@heroui/react";

interface PropTypes {
  params: Promise<{ id: string }>;
}
export default async function DetailDetection({ params }: PropTypes) {
  const { id } = await params;
  const session = await auth();

  return (
    <div>
      <Card>
        
      </Card>
    </div>
  );
}
