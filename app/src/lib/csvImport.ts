type IncomeCsvRow = {
  date: string;
  source: string;
  category: string;
  amount: number;
  currency: string;
  notes: string;
};

type InvalidIncomeCsvRow = {
  rowNumber: number;
  raw: Record<string, string>;
  errors: string[];
};

type FinanceCsvType = "income" | "expense";

type FinanceCsvRow = {
  type: FinanceCsvType;
  date: string;
  name: string;
  category: string;
  amount: number;
  isRecurring: boolean;
  notes: string;
  paymentMethod: string;
};

const REQUIRED_COLUMNS = ["date", "source", "amount"];
const FINANCE_REQUIRED_COLUMNS = ["date", "amount"];

function parseCsvRecords(text: string): string[][] {
  const records: string[][] = [];
  let record: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    const nextCharacter = text[index + 1];

    if (character === '"') {
      if (inQuotes && nextCharacter === '"') {
        field += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (character === "," && !inQuotes) {
      record.push(field);
      field = "";
      continue;
    }

    if ((character === "\n" || character === "\r") && !inQuotes) {
      record.push(field);
      records.push(record);
      record = [];
      field = "";

      if (character === "\r" && nextCharacter === "\n") {
        index += 1;
      }
      continue;
    }

    field += character;
  }

  if (field || record.length > 0) {
    record.push(field);
    records.push(record);
  }

  return records.filter((csvRecord) =>
    csvRecord.some((csvField) => csvField.trim() !== ""),
  );
}

function isValidIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;

  const parsedDate = new Date(`${value}T00:00:00.000Z`);
  return (
    !Number.isNaN(parsedDate.getTime()) &&
    parsedDate.toISOString().slice(0, 10) === value
  );
}

function normalizeBoolean(value: string): boolean {
  return ["true", "yes", "y", "1", "monthly"].includes(value.trim().toLowerCase());
}

function normalizeRecordType(value: string): FinanceCsvType | "" {
  const normalized = value.trim().toLowerCase();
  if (["income", "in"].includes(normalized)) return "income";
  if (["expense", "expenses", "out"].includes(normalized)) return "expense";
  return "";
}

export function parseIncomeCsv(text: string): {
  validRows: IncomeCsvRow[];
  invalidRows: InvalidIncomeCsvRow[];
} {
  const records = parseCsvRecords(text);
  const [headerRecord, ...dataRecords] = records;
  const validRows: IncomeCsvRow[] = [];
  const invalidRows: InvalidIncomeCsvRow[] = [];

  if (!headerRecord) {
    return {
      validRows,
      invalidRows: [
        {
          rowNumber: 1,
          raw: {},
          errors: ["Missing header row"],
        },
      ],
    };
  }

  const headers = headerRecord.map((header) => header.trim().toLowerCase());
  const missingColumns = REQUIRED_COLUMNS.filter(
    (column) => !headers.includes(column),
  );

  if (missingColumns.length > 0) {
    return {
      validRows,
      invalidRows: [
        {
          rowNumber: 1,
          raw: Object.fromEntries(
            headers.map((header, index) => [header || `column_${index + 1}`, headerRecord[index] ?? ""]),
          ),
          errors: missingColumns.map((column) => `Missing required column: ${column}`),
        },
      ],
    };
  }

  dataRecords.forEach((record, dataIndex) => {
    const raw = Object.fromEntries(
      headers.map((header, headerIndex) => [
        header || `column_${headerIndex + 1}`,
        (record[headerIndex] ?? "").trim(),
      ]),
    );
    const errors: string[] = [];
    const date = raw.date ?? "";
    const source = raw.source ?? "";
    const category = raw.category || "salary";
    const amount = Number(raw.amount);
    const currency = "HKD";
    const notes = raw.notes ?? "";

    if (!date) {
      errors.push("Date is required");
    } else if (!isValidIsoDate(date)) {
      errors.push("Invalid date");
    }

    if (!source) errors.push("Source is required");
    if (!raw.amount) {
      errors.push("Amount is required");
    } else if (!Number.isFinite(amount) || amount <= 0) {
      errors.push("Invalid amount");
    }

    if (errors.length > 0) {
      invalidRows.push({
        rowNumber: dataIndex + 2,
        raw,
        errors,
      });
      return;
    }

    validRows.push({
      date,
      source,
      category,
      amount,
      currency,
      notes,
    });
  });

  return { validRows, invalidRows };
}

export function parseFinanceCsv(text: string): {
  validRows: FinanceCsvRow[];
  invalidRows: InvalidIncomeCsvRow[];
} {
  const records = parseCsvRecords(text);
  const [headerRecord, ...dataRecords] = records;
  const validRows: FinanceCsvRow[] = [];
  const invalidRows: InvalidIncomeCsvRow[] = [];

  if (!headerRecord) {
    return {
      validRows,
      invalidRows: [
        {
          rowNumber: 1,
          raw: {},
          errors: ["Missing header row"],
        },
      ],
    };
  }

  const headers = headerRecord.map((header) => header.trim().toLowerCase());
  const hasTypeColumn = headers.includes("type");
  const hasNameColumn = headers.includes("name");
  const hasSourceColumn = headers.includes("source");
  const missingColumns = FINANCE_REQUIRED_COLUMNS.filter(
    (column) => !headers.includes(column),
  );

  if (!hasNameColumn && !hasSourceColumn) {
    missingColumns.push("name");
  }

  if (missingColumns.length > 0) {
    return {
      validRows,
      invalidRows: [
        {
          rowNumber: 1,
          raw: Object.fromEntries(
            headers.map((header, index) => [header || `column_${index + 1}`, headerRecord[index] ?? ""]),
          ),
          errors: missingColumns.map((column) => `Missing required column: ${column}`),
        },
      ],
    };
  }

  dataRecords.forEach((record, dataIndex) => {
    const raw = Object.fromEntries(
      headers.map((header, headerIndex) => [
        header || `column_${headerIndex + 1}`,
        (record[headerIndex] ?? "").trim(),
      ]),
    );
    const errors: string[] = [];
    const type = hasTypeColumn ? normalizeRecordType(raw.type ?? "") : "income";
    const date = raw.date ?? "";
    const name = raw.name || raw.source || "";
    const amount = Number(raw.amount);
    const category =
      raw.category || (type === "expense" ? "other" : "salary");
    const notes = raw.notes ?? "";
    const paymentMethod = raw.payment_method || raw.payment || "";
    const isRecurring = normalizeBoolean(raw.is_recurring || raw.recurring || "");

    if (!type) errors.push("Type must be income or expense");

    if (!date) {
      errors.push("Date is required");
    } else if (!isValidIsoDate(date)) {
      errors.push("Invalid date");
    }

    if (!name) errors.push("Name is required");

    if (!raw.amount) {
      errors.push("Amount is required");
    } else if (!Number.isFinite(amount) || amount <= 0) {
      errors.push("Invalid amount");
    }

    if (errors.length > 0 || !type) {
      invalidRows.push({
        rowNumber: dataIndex + 2,
        raw,
        errors,
      });
      return;
    }

    validRows.push({
      type,
      date,
      name,
      category,
      amount,
      isRecurring,
      notes,
      paymentMethod,
    });
  });

  return { validRows, invalidRows };
}
