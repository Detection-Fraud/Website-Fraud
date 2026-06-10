import {
  Modal,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
} from "@heroui/react";
import { ReactNode } from "react";
import { FiAlertTriangle } from "react-icons/fi";

interface ModalConfirmActionProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: ReactNode;
  confirmText: string;
  confirmColor?: "danger" | "success" | "primary" | "warning" | "default";
  isLoading?: boolean;
}

export default function ModalConfirmAction({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmText,
  confirmColor = "primary",
  isLoading = false,
}: ModalConfirmActionProps) {
  return (
    <Modal isOpen={isOpen} onOpenChange={onClose}>
      <Modal.Backdrop>
        <Modal.Container>
          <Modal.Dialog>
            <Modal.CloseTrigger />
            <Modal.Header className="flex flex-col gap-1">
              <Modal.Heading>
                <div className="flex items-center gap-2">
                  <div
                    className={`p-2 rounded-full ${
                      confirmColor === "danger"
                        ? "bg-red-100 text-red-600"
                        : "bg-blue-100 text-blue-600"
                    }`}
                  >
                    <FiAlertTriangle className="w-5 h-5" />
                  </div>
                  <span className="text-lg">{title}</span>
                </div>
              </Modal.Heading>
            </Modal.Header>
            <Modal.Body>
              <div className="text-slate-600">{description}</div>
            </Modal.Body>
            <Modal.Footer>
              <Button
                variant="outline"
                onPress={onClose}
                isDisabled={isLoading}
              >
                Batal
              </Button>
              <Button
                variant={"primary"}
                onPress={onConfirm}
                isPending={isLoading}
              >
                {confirmText}
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}
