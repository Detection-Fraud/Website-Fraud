"use client";

import {
  canExecuteEmployeeAdminAction,
  getEmployeeAdminActionLabel,
  getEmployeeAdminReasonLabel,
  type EmployeeAdminAction,
  type EmployeeAdminReason,
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

const actionConfirmation: Record<EmployeeAdminAction, string> = {
  ENSURE_ADMIN:
    "Aksi ini membuat akun ADMIN SSO untuk Employee dan memulainya dalam keadaan nonaktif. User.unitId yang sudah ada tetap ditampilkan dan tidak dipindahkan otomatis.",
  PROMOTE_VIEWER:
    "Aksi ini mempromosikan role VIEWER menjadi ADMIN, tetapi akun tetap nonaktif. User.unitId yang sudah ada tetap ditampilkan dan tidak dipindahkan otomatis.",
  ACTIVATE:
    "Aksi ini mengaktifkan akun ADMIN. User.unitId yang sudah ada tetap dipertahankan dan tidak dipindahkan otomatis.",
  DEACTIVATE:
    "Aksi ini menonaktifkan akun ADMIN. Role dan User.unitId tetap dipertahankan; unit tidak dipindahkan otomatis.",
  REVOKE_ADMIN:
    "Aksi ini mencabut role ADMIN dari akun. User.unitId yang sudah ada tetap dipertahankan dan tidak dipindahkan otomatis.",
};

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
    if (
      isPending ||
      !employee ||
      !action ||
      !canExecuteEmployeeAdminAction(action, reasons)
    ) {
      return;
    }

    try {
      await execute({ employeeId: employee.id, action });
      reset();
      onSuccess();
    } catch {
      // Error mutation tetap ditampilkan inline dan modal tetap terbuka.
    }
  };

  const confirmVariant =
    action === "DEACTIVATE" || action === "REVOKE_ADMIN"
      ? "danger"
      : action === "ACTIVATE"
        ? "secondary"
        : "primary";

  const confirmationCopy = action ? actionConfirmation[action] : null;

  return (
    <Modal isOpen={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <Modal.Backdrop variant="blur" isDismissable={!isPending}>
        <Modal.Container placement="center">
          <Modal.Dialog className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
            <Modal.CloseTrigger isDisabled={isPending} />

            <Modal.Header>
              <Modal.Heading>
                {action
                  ? getEmployeeAdminActionLabel(action)
                  : "Kelola akun ADMIN"}
              </Modal.Heading>
              <p className="text-sm text-slate-500">
                Siklus akun ini khusus untuk Employee dengan provider SSO dan
                role ADMIN.
              </p>
            </Modal.Header>

            <Modal.Body className="space-y-4">
              <div className="rounded-xl border border-blue-100 bg-blue-50 p-3 text-sm text-blue-950">
                {employee ? (
                  <>
                    <p className="font-semibold">{employee.name}</p>
                    <p className="text-xs text-blue-800">NIP {employee.nip}</p>
                    <p className="mt-2 text-xs text-blue-800">
                      User.unitId: {employee.user?.unitId ?? "Belum ditetapkan"}
                    </p>
                  </>
                ) : (
                  "Employee belum dipilih."
                )}
              </div>

              {confirmationCopy && (
                <p className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
                  {confirmationCopy}
                </p>
              )}

              {reasons.length > 0 && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                  <p className="font-semibold">Catatan kelayakan aksi</p>
                  <ul className="mt-1 list-disc space-y-1 pl-5">
                    {reasons.map((reason) => (
                      <li key={reason}>
                        {getEmployeeAdminReasonLabel(reason)}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {error && (
                <p
                  role="alert"
                  className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700"
                >
                  {error}
                </p>
              )}
            </Modal.Body>

            <Modal.Footer className="flex justify-end gap-2">
              <Button
                variant="secondary"
                onPress={handleClose}
                isDisabled={isPending}
              >
                Batal
              </Button>

              <Button
                variant={confirmVariant}
                onPress={handleConfirm}
                isDisabled={
                  isPending ||
                  !employee ||
                  !action ||
                  !canExecuteEmployeeAdminAction(action, reasons)
                }
              >
                {isPending
                  ? "Menyimpan..."
                  : action
                    ? getEmployeeAdminActionLabel(action)
                    : "Konfirmasi"}
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}
