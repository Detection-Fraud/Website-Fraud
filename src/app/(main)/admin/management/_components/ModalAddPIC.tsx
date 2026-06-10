"use client";

import { UNIT_ICON } from "@/constants/users.constants";
import { useAddPic } from "@/hooks/useAddPic";
import { useSearchPic } from "@/hooks/useSearchPic";
import {
  Autocomplete,
  Button,
  EmptyState,
  Form,
  Label,
  ListBox,
  ListBoxItem,
  Modal,
  SearchField,
  Surface,
} from "@heroui/react";
import { FiLock } from "react-icons/fi";

interface ModalAddPICProps {
  isOpen: boolean;
  onClose: () => void;
  selectedUnit: {
    id: string;
    name: string;
    type: string;
  } | null;
  onSuccess: () => void;
}

const UNIT_TYPE_LABEL: Record<string, string> = {
  KANWIL: "Kanwil",
  KANCAB: "Kancab",
  DIVISI: "Divisi",
};

export default function ModalAddPic({
  isOpen,
  onClose,
  selectedUnit,
  onSuccess,
}: ModalAddPICProps) {
  const {
    query,
    results,
    isLoading: isSearchLoading,
    selectedUser,
    setQuery,
    setSelectedUser,
    clearSelected,
  } = useSearchPic({ unitId: selectedUnit?.id });

  const { promotePic, isSubmitting, submitError, clearError } = useAddPic({
    onSuccess,
  });

  const unitTypeLabel = selectedUnit
    ? (UNIT_TYPE_LABEL[selectedUnit.type] ?? selectedUnit.type)
    : "";

  const Icon = selectedUnit
    ? (UNIT_ICON[selectedUnit.type] ?? UNIT_ICON["KANWIL"])
    : null;

  const canSubmit = !!selectedUser && !!selectedUnit;

  const handleClose = () => {
    clearSelected();
    clearError();
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!canSubmit || !selectedUnit) return;

    await promotePic({
      userId: selectedUser!.id,
      unitId: selectedUnit.id,
    });
  };

  return (
    <Modal isOpen={isOpen} onOpenChange={handleClose}>
      <Modal.Backdrop variant="blur">
        <Modal.Container placement="center">
          <Modal.Dialog className="max-w-lg w-full">
            <Modal.CloseTrigger />

            <Modal.Header className="pb-0">
              <div className="flex items-center gap-2 mb-2">
                <span
                  className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-sky-100 text-sky-700
                "
                >
                  {unitTypeLabel}
                </span>

                <span className="text-xs text-slate-400 font-medium">
                  PIC Baru
                </span>
              </div>

              <h2 className="text-xl font-bold text-slate-800 leading-tight">
                Tambah PIC Baru {selectedUnit ? `- ${selectedUnit.name}` : ""}
              </h2>

              <p className="text-sm text-slate-500 mt-1">
                Unit kerja terkunci otomatis sesuai dengan
                {unitTypeLabel}
              </p>
            </Modal.Header>

            <Modal.Body className="pt-4">
              <Surface className="m-2" variant="default">
                <Form onSubmit={handleSubmit} className="flex flex-col gap-5">
                  <div className="flex flex-col gap-1.5">
                    <Autocomplete
                      items={results}
                      value={selectedUser?.id ?? null}
                      onChange={(key) => {
                        const found = results.find((r) => r.id === String(key));
                        setSelectedUser(found ?? null);
                      }}
                      allowsEmptyCollection
                      selectionMode="single"
                      placeholder="Pilih nama PIC..."
                      aria-label="Cari nama PIC"
                      className="w-full"
                    >
                      <Label className="text-sm font-semibold text-slate-700">
                        Nama
                      </Label>

                      <Autocomplete.Trigger>
                        <Autocomplete.Value />
                        <Autocomplete.ClearButton />
                        <Autocomplete.Indicator />
                      </Autocomplete.Trigger>

                      <Autocomplete.Popover>
                        <Autocomplete.Filter
                          inputValue={query}
                          onInputChange={(val) => {
                            setQuery(val);
                            if (selectedUser && val !== selectedUser.name) {
                              setSelectedUser(null);
                            }
                          }}
                        >
                          <SearchField
                            autoFocus
                            name="search"
                            variant="secondary"
                            className="w-full"
                          >
                            <SearchField.Group>
                              <SearchField.SearchIcon />
                              <SearchField.Input placeholder="Cari nama..." />
                              <SearchField.ClearButton />
                            </SearchField.Group>
                          </SearchField>

                          <ListBox
                            renderEmptyState={() => (
                              <EmptyState>
                                {isSearchLoading
                                  ? "Mencari..."
                                  : query.length < 2
                                    ? "Ketik nama untuk mencari"
                                    : "User tidak ditemukan"}
                              </EmptyState>
                            )}
                          >
                            {results.map((user) => (
                              <ListBoxItem
                                key={user.id}
                                textValue={user.name}
                                id={user.id}
                              >
                                {user.name}
                              </ListBoxItem>
                            ))}
                          </ListBox>
                        </Autocomplete.Filter>
                      </Autocomplete.Popover>
                    </Autocomplete>
                    {query.length > 0 && query.length < 2 && (
                      <p className="text-xs text-slate-400">
                        Ketik minimal 2 karakter untuk mencari
                      </p>
                    )}
                  </div>
                  {selectedUser && (
                    <div className="flex flex-col gap-1.5">
                      <label className="text-sm font-semibold text-slate-700">
                        NIP
                      </label>
                      <div className="flex items-center gap-2 border border-slate-200 rounded-xl px-3 py-2.5 bg-slate-50">
                        <span className="text-slate-400 text-sm font-mono">
                          #
                        </span>
                        <span className="text-sm font-mono text-slate-700">
                          {selectedUser.username ?? "-"}
                        </span>
                      </div>
                    </div>
                  )}

                  <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-semibold text-slate-700">
                      Unit Kerja
                    </label>
                    <div className="flex items-center justify-between border border-sky-200 rounded-xl px-3 py-2.5 bg-sky-50">
                      <div className="flex items-center gap-2">
                        {Icon && (
                          <Icon className="w-4 h-4 text-sky-600 shrink-0" />
                        )}
                        <span className="text-sm font-semibold text-sky-700">
                          {selectedUnit?.name ?? "-"}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <FiLock className="w-3 h-3 text-sky-400" />
                        <span className="text-xs text-sky-500 font-medium">
                          (Terkunci)
                        </span>
                      </div>
                    </div>
                  </div>
                  {submitError && (
                    <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 border border-red-100 text-red-600 text-sm">
                      <span>⚠️</span>
                      <span>{submitError}</span>
                    </div>
                  )}

                  <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-100">
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={handleClose}
                      isDisabled={isSubmitting}
                    >
                      Batal
                    </Button>
                    <Button
                      type="submit"
                      variant="primary"
                      className="bg-sky-600 text-white hover:bg-sky-700"
                      isDisabled={!canSubmit}
                      isPending={isSubmitting}
                    >
                      {isSubmitting ? "Menambahkan..." : "Tambahkan PIC"}
                    </Button>
                  </div>
                </Form>
              </Surface>
            </Modal.Body>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}
