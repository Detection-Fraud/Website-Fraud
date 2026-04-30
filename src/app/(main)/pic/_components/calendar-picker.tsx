"use client";

import type { DateValue } from "@internationalized/date";
import { Calendar, DateField, DatePicker, Label } from "@heroui/react";

interface CalendarPickerProps {
  value: DateValue | null;
  onChange: (value: DateValue | null) => void;
  label?: string;
  name?: string;
  isRequired?: boolean;
  isDisabled?: boolean;
}

export default function CalendarPicker({
  value,
  onChange,
  label,
  name = "date",
  isRequired = false,
  isDisabled = false,
}: CalendarPickerProps) {
  return (
    <DatePicker
      className="w-full"
      name={name}
      value={value}
      onChange={onChange}
      isRequired={isRequired}
      isDisabled={isDisabled}
    >
      {label && <Label className="text-sm font-medium">{label}</Label>}
      <DateField.Group fullWidth>
        <DateField.Input>
          {(segment) => <DateField.Segment segment={segment} />}
        </DateField.Input>
        <DateField.Suffix>
          <DatePicker.Trigger>
            <DatePicker.TriggerIndicator />
          </DatePicker.Trigger>
        </DateField.Suffix>
      </DateField.Group>
      <DatePicker.Popover>
        <Calendar aria-label={label || "Pilih tanggal"}>
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
