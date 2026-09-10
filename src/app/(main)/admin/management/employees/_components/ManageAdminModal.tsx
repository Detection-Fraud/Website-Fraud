"use client";

import {
  canExecuteEmployeeAdminAction,
  getEmployeeAdminReasonLabel,
  getEmployeeAdminActionLabel,
  type EmployeeAdminReason,
  type EmployeeAdminAction,
} from "@/lib/employee-management-actions";
import { useEmployeeAdminMutation } from "@/hooks/useEmployeeAdminMutation";
import type { EmployeeAccount } from "@/types/user.types";
import { Button, Modal } from "@heroui/react";
import { useEffect } from "react";

interface ManageAdminModalProps {
  employee: EmployeeAccount | null;
  action: EmployeeAdminAction | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  reasons: EmployeeAdminReason[];
}

export default function ManageAdminModal({
  employee,
  action,
  isOpen,
  onClose,
  onSuccess,
  reasons,
}: ManageAdminModalProps) {
  const { execute, isPending, error, reset } = useEmployeeAdminMutation();

  useEffect(() => {
    if (!isOpen) reset();
  }, [isOpen, reset]);

  const handleClose = () => {
    if (isPending) return;
    reset();
    onClose();
  };

  const handleConfirm = async () => {
    if (!employee || !action || !canExecuteEmployeeAdminAction(action, reasons)) return;

    try {
      await execute({ employeeId: employee.id, action });
      reset();
      onSuccess();
    } catch {
      // The mutation error is rendered in the modal and keeps confirmation open.
    }
  };

  return (
    <Modal isOpen={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <Modal.Backdrop variant="blur">
        <Modal.Container placement="center">
          <Modal.Dialog className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
            <Modal.CloseTrigger />
            <Modal.Header>
              <Modal.Heading>{action ? getEmployeeAdminActionLabel(action) : "Kelola akun ADMIN"}</Modal.Heading>
              <p className="text-sm text-slate-500">
                Siklus akun ini khusus untuk Employee dengan provider SSO dan role ADMIN.
              </p>
            </Modal.Header>
            <Modal.Body className="space-y-4">
              <div className="rounded-xl border border-blue-100 bg-blue-50 p-3 text-sm text-blue-950">
                {employee ? (
                  <>
                    <p className="font-semibold">{employee.name}</p>
                    <p className="text-xs text-blue-800">NIP {employee.nip}</p>
                  </>
                ) : (
                  "Employee belum dipilih."
                )}
              </div>
              {reasons.length > 0 && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                  <p className="font-semibold">Catatan kelayakan aksi</p>
                  <ul className="mt-1 list-disc space-y-1 pl-5">
                    {reasons.map((reason) => (
                      <li key={reason}>{getEmployeeAdminReasonLabel(reason)}</li>
                    ))}
                  </ul>
                </div>
              )}
              {error && (
                <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
                  {error}
                </p>
              )}
              <div className="flex justify-end gap-2">
                <Button variant="secondary" onPress={handleClose} isDisabled={isPending}>
                  Batal
                </Button>
                <Button
                  variant="primary"
                  onPress={handleConfirm}
                  isPending={isPending}
                  isDisabled={
                    !employee ||
                    !action ||
                    !canExecuteEmployeeAdminAction(action, reasons)
                  }
                >
                  {action ? getEmployeeAdminActionLabel(action) : "Konfirmasi"}
                </Button>
              </div>
            </Modal.Body>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}
