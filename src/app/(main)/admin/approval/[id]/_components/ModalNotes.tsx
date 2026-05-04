import { useApproval } from "@/hooks/useApproval";
import { Button, Label, Modal, TextArea, TextField, Form } from "@heroui/react";
import { FiAlertTriangle } from "react-icons/fi";
import { IoCloseCircleOutline } from "react-icons/io5";

interface PropTypes {
  isOpen: boolean;
  onClose: () => void;
  namaPic?: string;
  id: string;
}
export default function ModalNotes({ isOpen, onClose, namaPic, id }: PropTypes) {
  const { handleReject, isLoading } = useApproval();

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const notes = formData.get("notes") as string;
    
    if (!notes?.trim()) return;

    const success = await handleReject(id, notes);
    if (success) {
      onClose();
    }
  };

  return (
    <Modal isOpen={isOpen} onOpenChange={onClose}>
      <Modal.Backdrop>
        <Modal.Container>
          <Modal.Dialog className="sm:max-w-md space-y-3">
            <Modal.CloseTrigger />
            <Modal.Header className="flex flex-row items-center">
              <Modal.Icon className="bg-red-100 w-10 h-10 rounded-lg">
                <IoCloseCircleOutline className="text-red-500 w-6 h-6" />
              </Modal.Icon>
              <Modal.Heading>
                <div>
                  <p className="font-bold text-gray-900 text-lg">
                    Tolak Pengajuan
                  </p>
                  <p className="text-sm text-muted">dari {namaPic}</p>
                </div>
              </Modal.Heading>
            </Modal.Header>
            <Modal.Body className="px-2 space-y-3">
              <Form onSubmit={onSubmit}>
                <TextField isRequired>
                  <Label htmlFor="notes">Alasan Penolakan</Label>
                  <TextArea
                    name="notes"
                    id="notes"
                    placeholder="Tuliskan alasan penolakan secara jelas agar pengirim dapat memahami dan memperbaiki pengajuannya..."
                    rows={4}
                    className={"border border-gray-200 shadow-sm"}
                  />
                </TextField>

                <div className="bg-orange-50 border border-orange-200 rounded-xl p-3 mb-5 flex gap-2.5 mt-3">
                  <FiAlertTriangle className="text-orange-600 w-5 h-5" />
                  <p className="text-xs text-orange-700 leading-relaxed">
                    Setelah ditolak, pengirim akan menerima notifikasi beserta
                    alasan yang Anda tulis dan diminta untuk upload ulang.
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant={"outline"}
                    className="flex-1"
                    onClick={onClose}
                    isDisabled={isLoading}
                  >
                    Batal
                  </Button>
                  <Button 
                    variant={"danger"} 
                    className="flex-1" 
                    type="submit"
                    isPending={isLoading}
                  >
                    {!isLoading && <IoCloseCircleOutline />}
                    Konfirmasi Tolak
                  </Button>
                </div>
              </Form>
            </Modal.Body>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}
