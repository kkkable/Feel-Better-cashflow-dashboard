export const INCOME_CSV_TEMPLATE_FILENAME = "finance-records-import-template.csv";

const EN_TEMPLATE = [
  "type,date,name,amount,category,is_recurring,notes,payment_method",
  "income,2026-06-01,Salary,30000,salary,true,Monthly salary,",
  "income,2026-06-15,Freelance Project,5000,freelance,false,Client payment,",
  "expense,2026-06-02,Citysuper,480,food,false,Groceries,card",
  "expense,2026-06-03,MTR,360,transport,true,Monthly transit,Octopus",
].join("\n");

const ZH_HANT_TEMPLATE = [
  "type,date,name,amount,category,is_recurring,notes,payment_method",
  "income,2026-06-01,薪金,30000,salary,true,每月薪金,",
  "income,2026-06-15,自由工作項目,5000,freelance,false,客戶付款,",
  "expense,2026-06-02,超級市場,480,food,false,日用品,信用卡",
  "expense,2026-06-03,港鐵,360,transport,true,每月交通費,八達通",
].join("\n");

export const INCOME_CSV_TEMPLATE_TEXT = EN_TEMPLATE;

export function getIncomeCsvTemplateText(language = "en") {
  return language === "zh-Hant" ? ZH_HANT_TEMPLATE : EN_TEMPLATE;
}

export function getIncomeCsvTemplateHref(language = "en") {
  return `data:text/csv;charset=utf-8,${encodeURIComponent(getIncomeCsvTemplateText(language))}`;
}
