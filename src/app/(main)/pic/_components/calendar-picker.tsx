"use client";

import type { DateValue } from "@internationalized/date";
import {
  Calendar,
  DateField,
  DatePicker,
  FieldError,
  Label,
} from "@heroui/react";

interface CalendarPickerProps {
  value: DateValue | null;
  onChange: (value: DateValue | null) => void;
  label?: string;
  name?: string;
  isRequired?: boolean;
  isDisabled?: boolean;

  minValue?: DateValue;
  maxValue?: DateValue;
  variant?: "primary" | "secondary";
  isInvalid?: boolean;
}

export default function CalendarPicker({
  value,
  onChange,
  label,
  name = "date",
  isRequired = false,
  isDisabled = false,
  minValue,
  variant = "primary",
  isInvalid = false,
  maxValue,
}: CalendarPickerProps) {
  return (
    <DatePicker
      className="w-full"
      name={name}
      value={value}
      onChange={onChange}
      isRequired={isRequired}
      isDisabled={isDisabled}
      minValue={minValue}
      maxValue={maxValue}
      isInvalid={isInvalid}
    >
      {label && <Label className="text-sm font-medium">{label}</Label>}
      <DateField.Group fullWidth variant={variant}>
        <DateField.Input>
          {(segment) => <DateField.Segment segment={segment} />}
        </DateField.Input>
        <DateField.Suffix>
          <DatePicker.Trigger>
            <DatePicker.TriggerIndicator />
          </DatePicker.Trigger>
        </DateField.Suffix>
      </DateField.Group>
      {isInvalid && (
        <FieldError>Tanggal berakhir harus setelah tanggal mulai</FieldError>
      )}
      <DatePicker.Popover>
        <Calendar
          aria-label={label || "Pilih tanggal"}
          minValue={minValue}
          maxValue={maxValue}
        >
          <Calendar.Header>
            <Calendar.YearPickerTrigger>
              <Calendar.YearPickerTriggerHeading />
              <Calendar.YearPickerTriggerIndicator />
            </Calendar.YearPickerTrigger>
            <Calendar.NavButton slot="previous" />
            <Calendar.NavButton slot="next" />
          </Calendar.Header>
          <Calendar.Grid>
            <Calendar.GridHeader>
              {(day) => <Calendar.HeaderCell>{day}</Calendar.HeaderCell>}
            </Calendar.GridHeader>
            <Calendar.GridBody>
              {(date) => <Calendar.Cell date={date} />}
            </Calendar.GridBody>
          </Calendar.Grid>
          <Calendar.YearPickerGrid>
            <Calendar.YearPickerGridBody>
              {({ year }) => <Calendar.YearPickerCell year={year} />}
            </Calendar.YearPickerGridBody>
          </Calendar.YearPickerGrid>
        </Calendar>
      </DatePicker.Popover>
    </DatePicker>
  );
}
