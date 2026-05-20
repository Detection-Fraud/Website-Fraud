import CalendarPicker from "@/app/(main)/pic/_components/calendar-picker";
import { ProgramBudaya } from "@generated/prisma";
import {
  Button,
  Description,
  FieldError,
  FieldGroup,
  Fieldset,
  Form,
  Input,
  Label,
  Modal,
  Surface,
  TextField,
} from "@heroui/react";
import { DateValue, parseDate } from "@internationalized/date";
import { useState } from "react";
import { AiOutlineInfoCircle } from "react-icons/ai";

interface ModalFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
  isLoading?: boolean;
  program?: ProgramBudaya | null;
}

export default function ModalForm({
  isOpen,
  onClose,
  onSubmit,
  isLoading,
  program,
}: ModalFormProps) {
  const [startValue, setStartValue] = useState<DateValue | null>(null);
  const [endValue, setEndValue] = useState<DateValue | null>(null);
  const startDate = startValue;
  const endDate = endValue;
  const isInvalid = endDate ? endDate < startDate! : false;

  const [prevIsOpen, setPrevIsOpen] = useState(isOpen);
  const [prevProgram, setPrevProgram] = useState(program);

  if (isOpen !== prevIsOpen || program !== prevProgram) {
    setPrevIsOpen(isOpen);
    setPrevProgram(program);

    if (isOpen && program) {
      try {
        if (program.startDate) {
          const dateOnly = new Date(program.startDate)
            .toISOString()
            .split("T")[0];
          setStartValue(parseDate(dateOnly));
        }
        if (program.endDate) {
          const dateOnly = new Date(program.endDate)
            .toISOString()
            .split("T")[0];
          setEndValue(parseDate(dateOnly));
        }
      } catch (e) {
        console.error("Gagal parsing tanggal", e);
      }
    } else if (isOpen && !program) {
      setStartValue(null);
      setEndValue(null);
    }
  }

  return (
    <Modal isOpen={isOpen} onOpenChange={onClose}>
      <Modal.Backdrop variant="blur">
        <Modal.Container placement="center">
          <Modal.Dialog className="max-w-md">
            <Modal.CloseTrigger />
            <Modal.Header>
              <Modal.Icon className="bg-default text-foreground">
                <AiOutlineInfoCircle className="size-5" />
              </Modal.Icon>
            </Modal.Header>

            <Modal.Body>
              <Surface variant="default" className="m-2">
                <Form onSubmit={onSubmit}>
                  <Fieldset>
                    <Fieldset.Legend>Data Program</Fieldset.Legend>
                    <Description>Lengkapi form dibawah ini</Description>
                    <FieldGroup>
                      <TextField
                        isRequired
                        name="name"
                        defaultValue={program?.name || ""}
                        validate={(value) => {
                          if (!value) {
                            return "Input tidak boleh kosong";
                          }
                          if (value.length < 3) {
                            return "Nama program minimal 3 karakter";
                          }
                          return null;
                        }}
                      >
                        <Label>Nama Program</Label>
                        <Input
                          placeholder="Sosialisasi Akhlak"
                          variant="secondary"
                        />
                        <FieldError />
                      </TextField>
                      <TextField
                        isRequired
                        name="frequency"
                        defaultValue={program?.frequency?.toString() || ""}
                        validate={(value) => {
                          const numberValue = Number(value);
                          if (Number.isNaN(numberValue)) {
                            return "Input harus berupa angka";
                          }
                          if (numberValue < 1) {
                            return "Input harus lebih dari 0";
                          }
                          return null;
                        }}
                      >
                        <Label>Frequency Program Budaya</Label>
                        <Input placeholder="12" variant="secondary" />
                        <FieldError />
                      </TextField>
                      <CalendarPicker
                        name="startDate"
                        value={startValue}
                        onChange={(value) => setStartValue(value)}
                        label="Tanggal Mulai"
                        isRequired
                        variant="secondary"
                      />
                      <CalendarPicker
                        name="endDate"
                        value={endValue}
                        onChange={(value) => setEndValue(value)}
                        label="Tanggal Berakhir"
                        isRequired
                        variant="secondary"
                        isInvalid={isInvalid}
                      />
                    </FieldGroup>

                    <Fieldset.Actions>
                      <Button
                        type="submit"
                        variant="primary"
                        isPending={isLoading}
                      >
                        {isLoading ? "Menyimpan..." : "Simpan"}
                      </Button>
                      <Button
                        variant="secondary"
                        onClick={onClose}
                        isDisabled={isLoading}
                      >
                        Batal
                      </Button>
                    </Fieldset.Actions>
                  </Fieldset>
                </Form>
              </Surface>
            </Modal.Body>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}
