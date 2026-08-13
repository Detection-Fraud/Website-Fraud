import { useApproval } from "@/hooks/useApproval";
import { Button, CloseButton, Form, Label, Modal, TextArea, TextField } from "@heroui/react";
import { useState } from "react";
import { FiAlertTriangle } from "react-icons/fi";
import { IoCloseCircleOutline } from "react-icons/io5";

interface PropTypes {
  isOpen: boolean;
  onClose: () => void;
  namaPic?: string;
  id: string;
}
export default function ModalNotes({
  isOpen,
  onClose,
  namaPic,
  id,
}: PropTypes) {
  const { handleReject, isLoading } = useApproval();

  const [notes, setNotes] = useState("");
  const isTooShort = notes.trim().length > 0 && notes.trim().length < 10;

  const canSubmit = notes.trim().length >= 10;

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const notes = formData.get("notes") as string;

    if (!notes?.trim()) return;

    if (!canSubmit) return;

    try {
      await handleReject(id, notes);
      onClose();
      setNotes("");
    } catch (e) {
      // Error is handled via toast in useApproval
    }
  };

  return (
    <Modal isOpen={isOpen} onOpenChange={onClose}>
      <Modal.Backdrop>
        <Modal.Container>
          <Modal.Dialog className="sm:max-w-md space-y-4 rounded-2xl border border-slate-200/60 p-6 bg-white shadow-xl">
            <Modal.CloseTrigger />
            <Modal.Header className="flex flex-row items-center gap-3">
              <Modal.Icon className="bg-rose-50 w-11 h-11 rounded-xl flex items-center justify-center border border-rose-100 shrink-0">
                <IoCloseCircleOutline className="text-rose-600 w-6 h-6" />
              </Modal.Icon>
              <Modal.Heading>
                <div>
                  <p className="font-bold text-slate-900 text-lg leading-snug">
                    Tolak Pengajuan
                  </p>
                  <p className="text-xs text-slate-500">
                    Pengajuan dari: <span className="font-semibold text-slate-700">{namaPic || "Pelapor"}</span>
                  </p>
                </div>
              </Modal.Heading>
            </Modal.Header>

            <Modal.Body className="px-0 space-y-4">
              <Form onSubmit={onSubmit}>
                <TextField isRequired>
                  <Label htmlFor="notes" className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Alasan Penolakan
                  </Label>
                  <TextArea
                    name="notes"
                    id="notes"
                    placeholder="Tuliskan alasan penolakan secara jelas agar pengirim dapat memahami dan memperbaiki pengajuannya..."
                    rows={4}
                    className={`border ${isTooShort ? "border-rose-400 focus:ring-rose-500" : "border-slate-200 focus:border-slate-400"} rounded-xl text-sm p-3 focus:outline-none shadow-xs text-slate-800`}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                  />
                  <div className="flex justify-between items-center mt-1.5">
                    <div>
                      {isTooShort && (
                        <p className="text-xs text-rose-500 font-medium">
                          Minimal 10 karakter ({notes.trim().length}/10)
                        </p>
                      )}
                    </div>
                    <p
                      className={`text-xs tabular-nums font-medium ${
                        canSubmit ? "text-emerald-600" : "text-slate-400"
                      }`}
                    >
                      {notes.trim().length} karakter
                    </p>
                  </div>
                </TextField>

                <div className="bg-amber-50 border border-amber-200/80 rounded-xl p-3.5 my-4 flex gap-3 items-start">
                  <FiAlertTriangle className="text-amber-600 w-4 h-4 shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-800 leading-relaxed font-medium">
                    Setelah ditolak, pengirim akan menerima notifikasi beserta
                    alasan yang Anda tulis dan diminta untuk upload ulang.
                  </p>
                </div>

                <div className="flex gap-2.5 pt-2">
                  <Button
                    variant="outline"
                    className="flex-1 rounded-xl font-semibold border-slate-200 text-slate-700 hover:bg-slate-50"
                    onClick={onClose}
                    isDisabled={isLoading}
                  >
                    Batal
                  </Button>
                  <Button
                    className="flex-1 rounded-xl font-semibold bg-rose-600 hover:bg-rose-700 text-white shadow-xs"
                    type="submit"
                    isPending={isLoading}
                    isDisabled={!canSubmit}
                  >
                    {!isLoading && <IoCloseCircleOutline className="w-4 h-4" />}
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
