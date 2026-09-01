"use client";

import {
  ParticipationScoreData,
  useParticipationScore,
} from "@/hooks/useParticipationScore";
import { ParticipationScoreInput } from "@/schemas/participation-score.schema";
import {
  Button,
  Description,
  FieldError,
  Form,
  Input,
  Label,
  Modal,
  TextArea,
  TextField,
} from "@heroui/react";
import { FormEvent, useEffect, useRef, useState } from "react";

interface ParticipationScoreModalProps {
  isOpen: boolean;
  reportId: string | null;
  reportName?: string;
  onClose: () => void;
}

type ApiError = {
  response?: { status?: number; data?: { message?: string } };
  message?: string;
};

const dateFormatter = new Intl.DateTimeFormat("id-ID", {
  dateStyle: "medium",
  timeStyle: "short",
});

function getErrorMessage(error: unknown): string {
  const apiError = error as ApiError;
  return (
    apiError.response?.data?.message ||
    apiError.message ||
    "Gagal menyimpan nilai"
  );
}

function getErrorStatus(error: unknown): number | undefined {
  return (error as ApiError).response?.status;
}

function currentAssessment(scoreData: ParticipationScoreData | undefined) {
  return scoreData?.assessment ?? null;
}

export default function ParticipationScoreModal({
  isOpen,
  reportId,
  reportName,
  onClose,
}: ParticipationScoreModalProps) {
  const {
    scoreData,
    scoreError,
    refetchScore,
    isLoadingScore,
    saveScore,
    isSavingScore,
  } = useParticipationScore(reportId ?? "");
  const assessment = currentAssessment(scoreData);
  const currentPercentage = assessment?.percentage ?? null;
  const assessmentVersion = assessment?.updatedAt ?? scoreData?.scoreStatus;
  const [value, setValue] = useState("");
  const [reason, setReason] = useState("");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [hasConflict, setHasConflict] = useState(false);
  const openedReportRef = useRef<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      openedReportRef.current = null;
      return;
    }

    if (openedReportRef.current === reportId) return;

    openedReportRef.current = reportId;
    setHasConflict(false);
    setReason("");
    setSubmitError(null);
  }, [isOpen, reportId]);

  useEffect(() => {
    if (!isOpen || scoreData === undefined) return;

    setValue(
      currentPercentage === null ? "" : String(currentPercentage),
    );
    setReason("");
  }, [
    assessmentVersion,
    currentPercentage,
    isOpen,
    reportId,
    scoreData,
  ]);

  const percentage = value === "" ? null : Number(value);
  const percentageIsValid =
    percentage !== null &&
    Number.isInteger(percentage) &&
    percentage >= 0 &&
    percentage <= 100;
  const changed =
    currentPercentage !== null && percentage !== currentPercentage;
  const reasonLength = reason.trim().length;
  const reasonIsValid =
    !changed || (reasonLength >= 10 && reasonLength <= 500);
  const canSubmit =
    scoreData !== undefined &&
    percentageIsValid &&
    (currentPercentage === null || changed) &&
    reasonIsValid &&
    !isSavingScore &&
    !hasConflict;

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canSubmit || percentage === null || reportId === null) return;

    const payload: ParticipationScoreInput = { percentage };
    if (changed && assessment) {
      payload.changeReason = reason.trim();
      payload.expectedUpdatedAt = assessment.updatedAt;
    }

    setSubmitError(null);
    try {
      await saveScore(payload);
      setHasConflict(false);
      onClose();
    } catch (error) {
      if (getErrorStatus(error) === 409) {
        setHasConflict(true);
        setSubmitError(
          "Nilai telah berubah. Tinjau data terbaru sebelum menyimpan kembali.",
        );
        return;
      }
      setSubmitError(getErrorMessage(error));
    }
  };

  const history = assessment?.scoreHistories ?? [];

  return (
    <Modal.Backdrop
      className="bg-slate-950/40 dark:bg-slate-950/60"
      isOpen={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <Modal.Container placement="auto" scroll="inside">
        <Modal.Dialog
          aria-describedby="score-description"
          aria-labelledby="score-title"
          className="w-[calc(100%-2rem)] max-h-[calc(100dvh-2rem)] overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[var(--surface-shadow-md)] sm:w-full sm:max-w-[40rem]"
        >
          <Modal.CloseTrigger className="min-h-11 min-w-11" />
          <Modal.Header className="border-b border-slate-100 px-5 py-5 pr-16 sm:px-7 sm:py-6 sm:pr-20">
            <div className="flex min-w-0 items-start gap-3">
              <div
                aria-hidden="true"
                className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-lg font-bold text-[var(--brand-navy-900)]"
              >
                %
              </div>
              <div className="min-w-0">
                <Modal.Heading id="score-title" className="line-clamp-2 text-lg font-bold tracking-tight text-foreground sm:text-xl">
                  {currentPercentage === null
                    ? "Isi Nilai Partisipasi"
                    : "Ubah Nilai Partisipasi"}
                </Modal.Heading>
                <p id="score-description" className="line-clamp-2 text-sm leading-5 text-muted">
                  {reportName ?? "Laporan disetujui"}
                </p>
              </div>
            </div>
            <div className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-blue-100 bg-blue-50/70 px-3.5 py-3 text-sm">
              <span className="text-muted">Nilai tersimpan</span>
              <span className="font-semibold tabular-nums text-[var(--brand-navy-900)]">
                {scoreError
                  ? "Tidak tersedia"
                  : isLoadingScore || scoreData === undefined
                    ? "Memuat..."
                    : currentPercentage === null
                      ? "Belum dinilai"
                      : `${currentPercentage}%`}
              </span>
            </div>
          </Modal.Header>

          <Form className="contents" onSubmit={submit}>
            <Modal.Body className="space-y-6 px-5 py-5 sm:px-7 sm:py-6">
              {isLoadingScore ? (
                <div className="space-y-6">
                  <div
                    aria-hidden="true"
                    className="space-y-3 animate-pulse motion-reduce:animate-none"
                  >
                    <div className="h-4 w-40 rounded bg-slate-200" />
                    <div className="h-16 w-full rounded-xl bg-slate-200" />
                    <div className="space-y-3">
                      <div className="h-4 w-32 rounded bg-slate-200" />
                      <div className="h-12 w-full rounded bg-slate-200" />
                      <div className="h-12 w-full rounded bg-slate-200" />
                    </div>
                  </div>
                  <p aria-live="polite" role="status">
                    Memuat data nilai...
                  </p>
                </div>
              ) : scoreError ? (
                <div
                  className="space-y-3 rounded-xl border border-danger/30 bg-danger/5 p-4"
                  role="alert"
                >
                  <p className="font-semibold text-foreground">
                    Gagal memuat data nilai
                  </p>
                  <p className="text-sm text-muted">
                    Data nilai tidak dapat dimuat. Coba lagi untuk mengambil
                    data terbaru.
                  </p>
                  <Button
                    type="button"
                    variant="secondary"
                    onPress={() => void refetchScore()}
                  >
                    Coba Lagi
                  </Button>
                </div>
              ) : (
                <>
                  <TextField
                    isRequired
                    name="percentage"
                    type="number"
                    value={value}
                    onChange={setValue}
                    validate={(text) => {
                      const number = Number(text);
                      return Number.isInteger(number) &&
                        number >= 0 &&
                        number <= 100
                        ? null
                        : "Nilai harus bilangan bulat 0 sampai 100";
                    }}
                  >
                    <Label>Persentase partisipasi</Label>
                    <div className="relative">
                      <Input
                        className="min-h-16 pe-12 text-2xl font-bold tabular-nums tracking-tight text-[var(--brand-navy-900)]"
                        inputMode="numeric"
                        min={0}
                        max={100}
                        step={1}
                      />
                      <span
                        aria-hidden="true"
                        className="pointer-events-none absolute inset-y-0 end-4 flex items-center text-base font-semibold text-muted"
                      >
                        %
                      </span>
                    </div>
                    <Description>
                      Bilangan bulat 0-100; nilai 0 tetap sah.
                    </Description>
                    <FieldError />
                  </TextField>

                  {changed && (
                    <div className="space-y-3 rounded-xl border border-blue-200/80 bg-blue-50/70 p-4 sm:p-5">
                      <div>
                        <h3 className="font-semibold text-foreground">
                          Alasan perubahan diperlukan
                        </h3>
                        <p className="mt-1 text-sm text-muted">
                          Jelaskan perubahan ini untuk menjaga catatan audit.
                        </p>
                      </div>
                      <TextField
                        isRequired
                        name="changeReason"
                        value={reason}
                        onChange={setReason}
                        validate={() =>
                          reasonLength >= 10 && reasonLength <= 500
                            ? null
                            : "Alasan perubahan harus 10-500 karakter setelah trim"
                        }
                      >
                        <Label>Alasan perubahan</Label>
                        <TextArea minLength={10} maxLength={500} rows={4} />
                        <Description>
                          {reasonLength}/500 karakter; minimal 10.
                        </Description>
                        <FieldError />
                      </TextField>
                    </div>
                  )}

                  {currentPercentage !== null && !changed && (
                    <p className="rounded-xl bg-surface-secondary px-4 py-3 text-sm text-muted">
                      Ubah nilai untuk mengaktifkan penyimpanan dan alasan
                      perubahan.
                    </p>
                  )}

                  {hasConflict ? (
                    <div
                      className="space-y-3 rounded-xl border border-danger/30 bg-danger/5 p-4"
                      role="alert"
                    >
                      <div>
                        <p className="font-semibold text-foreground">
                          Nilai telah berubah
                        </p>
                        <p className="mt-1 text-sm text-muted">
                          Nilai terbaru sudah dimuat. Tinjau data terbaru
                          sebelum menyimpan kembali.
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="secondary"
                        onPress={() => {
                          setHasConflict(false);
                          setSubmitError(null);
                        }}
                      >
                        Saya sudah meninjau data terbaru
                      </Button>
                    </div>
                  ) : submitError ? (
                    <div
                      className="space-y-2 rounded-xl border border-danger/30 bg-danger/5 p-4"
                      role="alert"
                    >
                      <p className="font-semibold text-foreground">
                        Gagal menyimpan nilai
                      </p>
                      <p className="text-sm text-danger">{submitError}</p>
                    </div>
                  ) : null}

                  <section aria-labelledby="score-history-title">
                    <div className="flex flex-wrap items-baseline justify-between gap-2 border-t border-slate-100 pt-6">
                      <h3
                        id="score-history-title"
                        className="font-semibold text-foreground"
                      >
                        Riwayat nilai
                      </h3>
                      <span className="text-xs text-muted">
                        Terbaru terlebih dahulu
                      </span>
                    </div>
                    {history.length === 0 ? (
                      <div className="mt-4 rounded-xl border border-slate-200/70 bg-surface-secondary p-4">
                        <p className="font-semibold text-foreground">
                          Belum ada riwayat nilai
                        </p>
                        <p className="mt-1 text-sm leading-5 text-muted">
                          Perubahan akan muncul setelah nilai disimpan.
                        </p>
                      </div>
                    ) : (
                      <ol className="relative mt-4 ms-2 space-y-4 border-s border-slate-200 ps-5">
                        {history.map((item, index) => (
                          <li
                            key={item.id}
                            className="relative min-w-0 text-sm"
                          >
                            <span
                              aria-hidden="true"
                              className={`absolute -start-[1.625rem] top-1.5 size-2.5 rounded-full border-2 border-surface ${index === 0 ? "bg-accent" : "bg-slate-300"}`}
                            />
                            {index === 0 && (
                              <p className="text-xs font-semibold text-accent">
                                Terbaru
                              </p>
                            )}
                            <p className="mt-1 flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-1 font-medium text-foreground">
                              {item.previousPercentage === null ? (
                                <>
                                  Nilai awal: <span className="font-semibold tabular-nums">{item.newPercentage}%</span>
                                </>
                              ) : (
                                <>
                                  <span className="tabular-nums text-muted">{item.previousPercentage}%</span>
                                  <span aria-hidden="true">→</span>
                                  <span className="font-semibold tabular-nums">{item.newPercentage}%</span>
                                </>
                              )}
                            </p>
                            <p className="mt-1 break-words text-xs leading-5 text-muted">
                              {item.actorName} · {dateFormatter.format(new Date(item.createdAt))}
                            </p>
                            {item.changeReason && (
                              <div className="mt-2 min-w-0 rounded-lg border border-slate-200/70 bg-slate-50 px-3 py-2.5">
                                <p className="text-xs font-semibold text-muted">
                                  Alasan perubahan
                                </p>
                                <p className="mt-1 break-words text-sm leading-5 text-foreground">
                                  {item.changeReason}
                                </p>
                              </div>
                            )}
                          </li>
                        ))}
                      </ol>
                    )}
                  </section>
                </>
              )}
            </Modal.Body>

            <Modal.Footer className="flex w-full flex-col-reverse gap-3 border-t border-slate-100 bg-slate-50/70 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-7">
              <Button
                className="min-h-11 w-full rounded-xl font-semibold active:scale-[0.98] sm:w-auto"
                type="button"
                variant="secondary"
                onPress={onClose}
                isDisabled={isSavingScore}
              >
                Batal
              </Button>
              <Button
                className="min-h-11 w-full rounded-xl font-semibold active:scale-[0.98] sm:w-auto"
                type="submit"
                isDisabled={!canSubmit}
                isPending={isSavingScore}
              >
                {currentPercentage === null
                  ? "Simpan Nilai"
                  : "Simpan Perubahan"}
              </Button>
            </Modal.Footer>
          </Form>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}
