import { Button, CloseButton, Modal } from "@heroui/react";
import { BiCheckCircle, BiPowerOff } from "react-icons/bi";
import { ProgramBudaya } from "@generated/prisma";

interface ModalStatusProps {
  isOpen: boolean;
  onClose: () => void;
  program: ProgramBudaya | null;
  onConfirm: () => void;
  isLoading?: boolean;
}

export default function ModalStatus({
  isOpen,
  onClose,
  program,
  onConfirm,
  isLoading,
}: ModalStatusProps) {
  if (!program) return null;

  const isActive = program.isActive;

  return (
    <Modal isOpen={isOpen} onOpenChange={onClose}>
      <Modal.Backdrop variant="opaque">
        <Modal.Container>
          <Modal.Dialog>
            <Modal.CloseTrigger />
            <Modal.Header>
              <Modal.Heading>
                {isActive ? "Nonaktifkan" : "Aktifkan"} Program
              </Modal.Heading>
            </Modal.Header>
            <Modal.Body>
              Apakah Anda yakin ingin{" "}
              {isActive ? "menonaktifkan" : "mengaktifkan"} program{" "}
              <strong>{program.name}</strong>?
            </Modal.Body>
            <Modal.Footer>
              <Button
                variant="outline"
                className={"border border-blue-800 text-blue-800 text-xs"}
                onPress={onClose}
                isDisabled={isLoading}
              >
                Batal
              </Button>
              <Button
                variant={isActive ? "danger" : "primary"}
                className={`text-xs ${!isActive ? "bg-emerald-600 text-white" : ""}`}
                onPress={onConfirm}
                isPending={isLoading}
              >
                {isActive ? (
                  <BiPowerOff className="w-3 h-3" />
                ) : (
                  <BiCheckCircle className="w-3 h-3" />
                )}
                {isActive ? "Nonaktifkan" : "Aktifkan"}
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}
