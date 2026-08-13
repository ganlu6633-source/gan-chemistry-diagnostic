import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const modernSecretKeys = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") || "{}");
const serviceKey = modernSecretKeys.default || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const db = createClient(supabaseUrl, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false }
});

const allowedOrigins = new Set([
  "https://ganlu6633-source.github.io",
  "https://gan-chemistry-diagnostic.ganlu6633.chatgpt.site"
]);
const REDOX_ASSESSMENT_KEY = "redox-foundations-v1";
const REDOX_DAY = 15;
const REDOX_TAGS = new Set([
  "化合价变化识别", "电子得失与方向", "氧化剂判断", "还原剂判断", "被氧化的物质",
  "被还原的物质", "氧化产物", "还原产物", "转移电子量计算", "电子守恒综合应用"
]);
const REDOX_SKILLS = [
  "化合价变化识别", "电子得失与方向", "氧化剂判断", "还原剂判断", "被氧化的物质",
  "被还原的物质", "氧化产物", "还原产物", "转移电子量计算", "电子守恒综合应用"
];
type RedoxQuestionManifest = { id: string; tag: string; level: number; adaptive: boolean; correctAnswer: string };
const REDOX_MANIFEST_B64 = [
  "W1siUkVET1gtMjAyNjA4MTMtVjEtUjJUTzUtUzAxX1ZBTEVOQ0VfQ0hBTkdFLUwxLUEiLDAsMSwxLCJabu+8mjDku7fihpIrMuS7t++8m0N177yaKzLku7fihpIw5Lu3Il0sWyJSRURPWC0yMDI2MDgxMy1WMS1SMlRPNS1TMDFfVkFMRU5DRV9DSEFOR0UtTDEtQiIsMCwxLDEsIkZl77yaMOS7t+KGkisy5Lu377ybSO+8misx5Lu34oaSMOS7tyJdLFsiUkVET1gtMjAyNjA4MTMtVjEtUjJUTzUtUzAxX1ZBTEVOQ0VfQ0hBTkdFLUwyLUEiLDAsMiwxLCJI77yaMOS7t+KGkisx5Lu377ybQ3XvvJorMuS7t+KGkjDku7ciXSxbIlJFRE9YLTIwMjYwODEzLVYxLVIyVE81LVMwMV9WQUxFTkNFX0NIQU5HRS1MMi1CIiwwLDIsMSwiQ++8mjDku7fihpIrNOS7t++8m0N177yaKzLku7fihpIw5Lu3Il0sWyJSRURPWC0yMDI2MDgxMy1WMS1SMlRPNS1TMDFfVkFMRU5DRV9DSEFOR0UtTDMtQSIsMCwzLDEsIkPvvJorMuS7t+KGkis05Lu377ybRmXvvJorM+S7t+KGkjDku7fvvJvovaznp7vnlLXlrZAxLjIwIG1vbCJdLFsiUkVET1gtMjAyNjA4MTMtVjEtUjJUTzUtUzAxX1ZBTEVOQ0VfQ0hBTkdFLUwzLUIiLDAsMywxLCJBbO+8mjDku7fihpIrM+S7t++8m0Zl77yaKzPku7fihpIw5Lu377yb6L2s56e755S15a2QMS44MCBtb2wiXSxbIlJFRE9YLTIwMjYwODEzLVYxLVIyVE81LVMwMV9WQUxFTkNFX0NIQU5HRS1MNC1BIiwwLDQsMSwiQ++8misy5Lu34oaSKzTku7fvvJtO77yaKzLku7fihpIw5Lu377yb6L2s56e755S15a2QMC40MCBtb2wiXSxbIlJFRE9YLTIwMjYwODEzLVYxLVIyVE81LVMwMV9WQUxFTkNFX0NIQU5HRS1MNC1CIiwwLDQsMSwiTmHvvJow5Lu34oaSKzHku7fvvJtUae+8mis05Lu34oaSMOS7t++8m+i9rOenu+eUteWtkDEuMjAgbW9sIl0sWyJSRURPWC0yMDI2MDgxMy1WMS1SMlRPNS1TMDJfRUxFQ1RST05fRElSRUNUSU9OLUwxLUEiLDEsMSwxLCLnlLXlrZDnlLFGZei9rOWQkUjigbrvvJtGZeWkseeUteWtkO+8jEjigbrlvpfnlLXlrZAiXSxbIlJFRE9YLTIwMjYwODEzLVYxLVIyVE81LVMwMl9FTEVDVFJPTl9ESVJFQ1RJT04tTDEtQiIsMSwxLDEsIueUteWtkOeUsVpu6L2s5ZCRQ3XCsuKBuu+8m1pu5aSx55S15a2Q77yMQ3XCsuKBuuW+l+eUteWtkCJdLFsiUkVET1gtMjAyNjA4MTMtVjEtUjJUTzUtUzAyX0VMRUNUUk9OX0RJUkVDVElPTi1MMi1BIiwxLDIsMSwi55S15a2Q55SxQWzovazlkJFGZeKCgk/igoPvvJtBbOWkseeUteWtkO+8jEZl4oKCT+KCg+W+l+eUteWtkCJdLFsiUkVET1gtMjAyNjA4MTMtVjEtUjJUTzUtUzAyX0VMRUNUUk9OX0RJUkVDVElPTi1MMi1CIiwxLDIsMSwi55S15a2Q55SxQ3XovazlkJFBZ+KBuu+8m0N15aSx55S15a2Q77yMQWfigbrlvpfnlLXlrZAiXSxbIlJFRE9YLTIwMjYwODEzLVYxLVIyVE81LVMwMl9FTEVDVFJPTl9ESVJFQ1RJT04tTDMtQSIsMSwzLDEsIueUteWtkOeUsUFs6L2s5ZCRQ3LigoJP4oKD77yb55S15a2Q6YeP5Li6MC45MCBtb2wiXSxbIlJFRE9YLTIwMjYwODEzLVYxLVIyVE81LVMwMl9FTEVDVFJPTl9ESVJFQ1RJT04tTDMtQiIsMSwzLDEsIueUteWtkOeUsUNh6L2s5ZCRVuKCgk/igoXvvJvnlLXlrZDph4/kuLoyLjUwIG1vbCJdLFsiUkVET1gtMjAyNjA4MTMtVjEtUjJUTzUtUzAyX0VMRUNUUk9OX0RJUkVDVElPTi1MNC1BIiwxLDQsMSwi55S15a2Q55SxQ3XovazlkJFGZcKz4oG677yb55S15a2Q6YeP5Li6MC4zMCBtb2wiXSxbIlJFRE9YLTIwMjYwODEzLVYxLVIyVE81LVMwMl9FTEVDVFJPTl9ESVJFQ1RJT04tTDQtQiIsMSw0LDEsIueUteWtkOeUsUjigoLovazlkJFXT+KCg++8m+eUteWtkOmHj+S4ujEuNTAgbW9sIl0sWyJSRURPWC0yMDI2MDgxMy1WMS1SMlRPNS1TMDRfUkVEVUNJTkdfQUdFTlQtTDEtQSIsMywxLDEsIkNPIl0sWyJSRURPWC0yMDI2MDgxMy1WMS1SMlRPNS1TMDRfUkVEVUNJTkdfQUdFTlQtTDEtQiIsMywxLDEsIkMiXSxbIlJFRE9YLTIwMjYwODEzLVYxLVIyVE81LVMwNF9SRURVQ0lOR19BR0VOVC1MMi1BIiwzLDIsMSwiWm7vvJtabiDnlLEw5Lu35Y+Y5Li6KzLku7fvvIzljYfku7flubblpLHnlLXlrZAiXSxbIlJFRE9YLTIwMjYwODEzLVYxLVIyVE81LVMwNF9SRURVQ0lOR19BR0VOVC1MMi1CIiwzLDIsMSwiQWzvvJtBbCDnlLEw5Lu35Y+Y5Li6KzPku7fvvIzljYfku7flubblpLHnlLXlrZAiXSxbIlJFRE9YLTIwMjYwODEzLVYxLVIyVE81LVMwNF9SRURVQ0lOR19BR0VOVC1MMy1BIiwzLDMsMSwiQ0/vvJswLjQwIG1vbOeUteWtkCJdLFsiUkVET1gtMjAyNjA4MTMtVjEtUjJUTzUtUzA0X1JFRFVDSU5HX0FHRU5ULUwzLUIiLDMsMywxLCJOYe+8mzEuMjAgbW9s55S15a2QIl0sWyJSRURPWC0yMDI2MDgxMy1WMS1SMlRPNS1TMDRfUkVEVUNJTkdfQUdFTlQtTDQtQSIsMyw0LDEsIkjigoLvvJvlhbPogZTnianotKjkuLpI4oKCT++8mzEuMjAgbW9s55S15a2QIl0sWyJSRURPWC0yMDI2MDgxMy1WMS1SMlRPNS1TMDRfUkVEVUNJTkdfQUdFTlQtTDQtQiIsMyw0LDEsIkNh77yb5YWz6IGU54mp6LSo5Li6Q2FP77ybMy4wMCBtb2znlLXlrZAiXSxbIlJFRE9YLTIwMjYwODEzLVYxLVIyVE81LVMwN19PWElEQVRJT05fUFJPRFVDVC1MMS1BIiw2LDEsMSwiRmVTT+KChCJdLFsiUkVET1gtMjAyNjA4MTMtVjEtUjJUTzUtUzA3X09YSURBVElPTl9QUk9EVUNULUwxLUIiLDYsMSwxLCJDdShOT+KCgynigoIiXSxbIlJFRE9YLTIwMjYwODEzLVYxLVIyVE81LVMwN19PWElEQVRJT05fUFJPRFVDVC1MMi1BIiw2LDIsMSwiSOKCgk/vvJtIIOeUsTDku7flj5jkuLorMeS7t++8jOWNh+S7t+W5tuWkseeUteWtkCJdLFsiUkVET1gtMjAyNjA4MTMtVjEtUjJUTzUtUzA3X09YSURBVElPTl9QUk9EVUNULUwyLUIiLDYsMiwxLCJDT+KCgu+8m0Mg55SxMOS7t+WPmOS4uis05Lu377yM5Y2H5Lu35bm25aSx55S15a2QIl0sWyJSRURPWC0yMDI2MDgxMy1WMS1SMlRPNS1TMDdfT1hJREFUSU9OX1BST0RVQ1QtTDMtQSIsNiwzLDEsIkNP4oKC77ybMS4yMCBtb2znlLXlrZAiXSxbIlJFRE9YLTIwMjYwODEzLVYxLVIyVE81LVMwN19PWElEQVRJT05fUFJPRFVDVC1MMy1CIiw2LDMsMSwiQWzigoJP4oKD77ybMS44MCBtb2znlLXlrZAiXSxbIlJFRE9YLTIwMjYwODEzLVYxLVIyVE81LVMwN19PWElEQVRJT05fUFJPRFVDVC1MNC1BIiw2LDQsMSwiQ0/igoLvvJvlhbPogZTnianotKjkuLpDT++8mzAuNDAgbW9s55S15a2QIl0sWyJSRURPWC0yMDI2MDgxMy1WMS1SMlRPNS1TMDdfT1hJREFUSU9OX1BST0RVQ1QtTDQtQiIsNiw0LDEsIk5hQ2zvvJvlhbPogZTnianotKjkuLpOYe+8mzEuMjAgbW9s55S15a2QIl0sWyJSRURPWC0yMDI2MDgxMy1WMS1SMlRPNS1TMDhfUkVEVUNUSU9OX1BST0RVQ1QtTDEtQSIsNywxLDEsIkN1Il0sWyJSRURPWC0yMDI2MDgxMy1WMS1SMlRPNS1TMDhfUkVEVUNUSU9OX1BST0RVQ1QtTDEtQiIsNywxLDEsIkjigoIiXSxbIlJFRE9YLTIwMjYwODEzLVYxLVIyVE81LVMwOF9SRURVQ1RJT05fUFJPRFVDVC1MMi1BIiw3LDIsMSwiQ3XvvJtDdSDnlLErMuS7t+WPmOS4ujDku7fvvIzpmY3ku7flubblvpfnlLXlrZAiXSxbIlJFRE9YLTIwMjYwODEzLVYxLVIyVE81LVMwOF9SRURVQ1RJT05fUFJPRFVDVC1MMi1CIiw3LDIsMSwiRmXvvJtGZSDnlLErM+S7t+WPmOS4ujDku7fvvIzpmY3ku7flubblvpfnlLXlrZAiXSxbIlJFRE9YLTIwMjYwODEzLVYxLVIyVE81LVMwOF9SRURVQ1RJT05fUFJPRFVDVC1MMy1BIiw3LDMsMSwiRmXvvJsxLjIwIG1vbOeUteWtkCJdLFsiUkVET1gtMjAyNjA4MTMtVjEtUjJUTzUtUzA4X1JFRFVDVElPTl9QUk9EVUNULUwzLUIiLDcsMywxLCJO4oKC77ybMC42MCBtb2znlLXlrZAiXSxbIlJFRE9YLTIwMjYwODEzLVYxLVIyVE81LVMwOF9SRURVQ1RJT05fUFJPRFVDVC1MNC1BIiw3LDQsMSwiRmVDbOKCgu+8m+WFs+iBlOeJqei0qOS4ukZlQ2zigoPvvJswLjQwIG1vbOeUteWtkCJdLFsiUkVET1gtMjAyNjA4MTMtVjEtUjJUTzUtUzA4X1JFRFVDVElPTl9QUk9EVUNULUw0LUIiLDcsNCwxLCJTae+8m+WFs+iBlOeJqei0qOS4ulNpT+KCgu+8mzEuMjAgbW9s55S15a2QIl0sWyJSRURPWC0yMDI2MDgxMy1WMS1SMlRPNS1TMDNfT1hJRElaSU5HX0FHRU5ULUwxLUEiLDIsMSwxLCJDdU8iXSxbIlJFRE9YLTIwMjYwODEzLVYxLVIyVE81LVMwM19PWElESVpJTkdfQUdFTlQtTDEtQiIsMiwxLDEsIkZl4oKCT+KCgyJdLFsiUkVET1gtMjAyNjA4MTMtVjEtUjJUTzUtUzAzX09YSURJWklOR19BR0VOVC1MMi1BIiwyLDIsMSwiQ3VP77ybQ3Ug55SxKzLku7flj5jkuLow5Lu377yM6ZmN5Lu35bm25b6X55S15a2QIl0sWyJSRURPWC0yMDI2MDgxMy1WMS1SMlRPNS1TMDNfT1hJRElaSU5HX0FHRU5ULUwyLUIiLDIsMiwxLCJGZeKCgk/igoPvvJtGZSDnlLErM+S7t+WPmOS4ujDku7fvvIzpmY3ku7flubblvpfnlLXlrZAiXSxbIlJFRE9YLTIwMjYwODEzLVYxLVIyVE81LVMwM19PWElESVpJTkdfQUdFTlQtTDMtQSIsMiwzLDEsIk5P77ybMC40MCBtb2znlLXlrZAiXSxbIlJFRE9YLTIwMjYwODEzLVYxLVIyVE81LVMwM19PWElESVpJTkdf",
  "QUdFTlQtTDMtQiIsMiwzLDEsIlRpQ2zigoTvvJsxLjIwIG1vbOeUteWtkCJdLFsiUkVET1gtMjAyNjA4MTMtVjEtUjJUTzUtUzAzX09YSURJWklOR19BR0VOVC1MNC1BIiwyLDQsMSwiRmVDbOKCg++8m+WFs+iBlOeJqei0qOS4ukZlQ2zigoLvvJswLjQwIG1vbOeUteWtkCJdLFsiUkVET1gtMjAyNjA4MTMtVjEtUjJUTzUtUzAzX09YSURJWklOR19BR0VOVC1MNC1CIiwyLDQsMSwiU2lP4oKC77yb5YWz6IGU54mp6LSo5Li6U2nvvJsxLjIwIG1vbOeUteWtkCJdLFsiUkVET1gtMjAyNjA4MTMtVjEtUjJUTzUtUzA1X09YSURJWkVEX1NVQlNUQU5DRS1MMS1BIiw0LDEsMSwiRmUiXSxbIlJFRE9YLTIwMjYwODEzLVYxLVIyVE81LVMwNV9PWElESVpFRF9TVUJTVEFOQ0UtTDEtQiIsNCwxLDEsIkN1Il0sWyJSRURPWC0yMDI2MDgxMy1WMS1SMlRPNS1TMDVfT1hJRElaRURfU1VCU1RBTkNFLUwyLUEiLDQsMiwxLCJI4oKC77ybSCDnlLEw5Lu35Y+Y5Li6KzHku7fvvIzljYfku7flubblpLHnlLXlrZAiXSxbIlJFRE9YLTIwMjYwODEzLVYxLVIyVE81LVMwNV9PWElESVpFRF9TVUJTVEFOQ0UtTDItQiIsNCwyLDEsIkPvvJtDIOeUsTDku7flj5jkuLorNOS7t++8jOWNh+S7t+W5tuWkseeUteWtkCJdLFsiUkVET1gtMjAyNjA4MTMtVjEtUjJUTzUtUzA1X09YSURJWkVEX1NVQlNUQU5DRS1MMy1BIiw0LDMsMSwiQ0/vvJsxLjIwIG1vbOeUteWtkCJdLFsiUkVET1gtMjAyNjA4MTMtVjEtUjJUTzUtUzA1X09YSURJWkVEX1NVQlNUQU5DRS1MMy1CIiw0LDMsMSwiQWzvvJsxLjgwIG1vbOeUteWtkCJdLFsiUkVET1gtMjAyNjA4MTMtVjEtUjJUTzUtUzA1X09YSURJWkVEX1NVQlNUQU5DRS1MNC1BIiw0LDQsMSwiQ0/vvJvlhbPogZTnianotKjkuLpDT+KCgu+8mzAuNDAgbW9s55S15a2QIl0sWyJSRURPWC0yMDI2MDgxMy1WMS1SMlRPNS1TMDVfT1hJRElaRURfU1VCU1RBTkNFLUw0LUIiLDQsNCwxLCJOYe+8m+WFs+iBlOeJqei0qOS4uk5hQ2zvvJsxLjIwIG1vbOeUteWtkCJdLFsiUkVET1gtMjAyNjA4MTMtVjEtUjJUTzUtUzA2X1JFRFVDRURfU1VCU1RBTkNFLUwxLUEiLDUsMSwxLCJGZeKCgk/igoMiXSxbIlJFRE9YLTIwMjYwODEzLVYxLVIyVE81LVMwNl9SRURVQ0VEX1NVQlNUQU5DRS1MMS1CIiw1LDEsMSwiQ3VPIl0sWyJSRURPWC0yMDI2MDgxMy1WMS1SMlRPNS1TMDZfUkVEVUNFRF9TVUJTVEFOQ0UtTDItQSIsNSwyLDEsIkZl4oKCT+KCg++8m0ZlIOeUsSsz5Lu35Y+Y5Li6MOS7t++8jOmZjeS7t+W5tuW+l+eUteWtkCJdLFsiUkVET1gtMjAyNjA4MTMtVjEtUjJUTzUtUzA2X1JFRFVDRURfU1VCU1RBTkNFLUwyLUIiLDUsMiwxLCJBZ05P4oKD77ybQWcg55SxKzHku7flj5jkuLow5Lu377yM6ZmN5Lu35bm25b6X55S15a2QIl0sWyJSRURPWC0yMDI2MDgxMy1WMS1SMlRPNS1TMDZfUkVEVUNFRF9TVUJTVEFOQ0UtTDMtQSIsNSwzLDEsIkZlQ2zigoPvvJswLjQwIG1vbOeUteWtkCJdLFsiUkVET1gtMjAyNjA4MTMtVjEtUjJUTzUtUzA2X1JFRFVDRURfU1VCU1RBTkNFLUwzLUIiLDUsMywxLCJTbk/igoLvvJsxLjIwIG1vbOeUteWtkCJdLFsiUkVET1gtMjAyNjA4MTMtVjEtUjJUTzUtUzA2X1JFRFVDRURfU1VCU1RBTkNFLUw0LUEiLDUsNCwxLCJW4oKCT+KChe+8m+WFs+iBlOeJqei0qOS4ulbvvJsyLjAwIG1vbOeUteWtkCJdLFsiUkVET1gtMjAyNjA4MTMtVjEtUjJUTzUtUzA2X1JFRFVDRURfU1VCU1RBTkNFLUw0LUIiLDUsNCwxLCJXT+KCg++8m+WFs+iBlOeJqei0qOS4ulfvvJsxLjgwIG1vbOeUteWtkCJdLFsiUkVET1gtMjAyNjA4MTMtVjEtUjJUTzUtUzA5X0VMRUNUUk9OX0FNT1VOVC1MMS1BIiw4LDEsMSwiMi4wMCBtb2wiXSxbIlJFRE9YLTIwMjYwODEzLVYxLVIyVE81LVMwOV9FTEVDVFJPTl9BTU9VTlQtTDEtQiIsOCwxLDEsIjIuMDAgbW9sIl0sWyJSRURPWC0yMDI2MDgxMy1WMS1SMlRPNS1TMDlfRUxFQ1RST05fQU1PVU5ULUwyLUEiLDgsMiwxLCIwLjUwIG1vbCJdLFsiUkVET1gtMjAyNjA4MTMtVjEtUjJUTzUtUzA5X0VMRUNUUk9OX0FNT1VOVC1MMi1CIiw4LDIsMSwiMS4yMCBtb2wiXSxbIlJFRE9YLTIwMjYwODEzLVYxLVIyVE81LVMwOV9FTEVDVFJPTl9BTU9VTlQtTDMtQSIsOCwzLDEsIjAuNjAgbW9sIl0sWyJSRURPWC0yMDI2MDgxMy1WMS1SMlRPNS1TMDlfRUxFQ1RST05fQU1PVU5ULUwzLUIiLDgsMywxLCIxLjIwIG1vbCJdLFsiUkVET1gtMjAyNjA4MTMtVjEtUjJUTzUtUzA5X0VMRUNUUk9OX0FNT1VOVC1MNC1BIiw4LDQsMSwiMi40McOXMTDCssKzIOS4qiJdLFsiUkVET1gtMjAyNjA4MTMtVjEtUjJUTzUtUzA5X0VMRUNUUk9OX0FNT1VOVC1MNC1CIiw4LDQsMSwiMy4wMcOXMTDCssKzIOS4qiJdLFsiUkVET1gtMjAyNjA4MTMtVjEtUjJUTzUtUzEwX0NPTlNFUlZBVElPTl9BUFBMSUNBVElPTi1MMS1BIiw5LDEsMSwi5b6X5Yiw55S15a2QMC40MCBtb2wiXSxbIlJFRE9YLTIwMjYwODEzLVYxLVIyVE81LVMxMF9DT05TRVJWQVRJT05fQVBQTElDQVRJT04tTDEtQiIsOSwxLDEsIuW+l+WIsOeUteWtkDAuNjAgbW9sIl0sWyJSRURPWC0yMDI2MDgxMy1WMS1SMlRPNS1TMTBfQ09OU0VSVkFUSU9OX0FQUExJQ0FUSU9OLUwyLUEiLDksMiwxLCLovaznp7swLjQwIG1vbOeUteWtkO+8m+eUn+aIkDAuMjAgbW9sIEN1Il0sWyJSRURPWC0yMDI2MDgxMy1WMS1SMlRPNS1TMTBfQ09OU0VSVkFUSU9OX0FQUExJQ0FUSU9OLUwyLUIiLDksMiwxLCLovaznp7swLjYwIG1vbOeUteWtkO+8m+eUn+aIkDAuNjAgbW9sIEFnIl0sWyJSRURPWC0yMDI2MDgxMy1WMS1SMlRPNS1TMTBfQ09OU0VSVkFUSU9OX0FQUExJQ0FUSU9OLUwzLUEiLDksMywxLCIwLjYwIG1vbOeUteWtkO+8mzExLjIwIGcgRmUiXSxbIlJFRE9YLTIwMjYwODEzLVYxLVIyVE81LVMxMF9DT05TRVJWQVRJT05fQVBQTElDQVRJT04tTDMtQiIsOSwzLDEsIjAuOTAgbW9s55S15a2Q77ybMTUuNjAgZyBDciJdLFsiUkVET1gtMjAyNjA4MTMtVjEtUjJUTzUtUzEwX0NPTlNFUlZBVElPTl9BUFBMSUNBVElPTi1MNC1BIiw5LDQsMSwi5aSx44CB5b6X55S15a2Q5Z2H5Li6Mi41MCBtb2zvvJvnkIborrrnlJ/miJAwLjUwIG1vbCBWIl0sWyJSRURPWC0yMDI2MDgxMy1WMS1SMlRPNS1TMTBfQ09OU0VSVkFUSU9OX0FQUExJQ0FUSU9OLUw0LUIiLDksNCwxLCLlpLHjgIHlvpfnlLXlrZDlnYfkuLoxLjgwIG1vbO+8m+eQhuiuuueUn+aIkDAuMzAgbW9sIFciXSxbIlJFRE9YLTIwMjYwODEzLVYxLVIyVE81LVMwMV9WQUxFTkNFX0NIQU5HRS1MMS1DIiwwLDEsMSwiQ3XvvJow5Lu34oaSKzLku7fvvJtBZ++8misx5Lu34oaSMOS7tyJdLFsiUkVET1gtMjAyNjA4MTMtVjEtUjJUTzUtUzAxX1ZBTEVOQ0VfQ0hBTkdFLUwxLUQiLDAsMSwxLCJDde+8mjDku7fihpIrMuS7t++8m0Zl77yaKzPku7fihpIrMuS7tyJdLFsiUkVET1gtMjAyNjA4MTMtVjEtUjJUTzUtUzAxX1ZBTEVOQ0VfQ0hBTkdFLUwxLUUiLDAsMSwxLCJD77yaMOS7t+KGkisy5Lu377ybU2nvvJorNOS7t+KGkjDku7ciXSxbIlJFRE9YLTIwMjYwODEzLVYxLVIyVE81LVMwMV9WQUxFTkNFX0NIQU5HRS1MMS1GIiwwLDEsMSwiSO+8mjDku7fihpIrMeS7t++8m1fvvJorNuS7t+KGkjDku7ciXSxbIlJFRE9YLTIwMjYwODEzLVYxLVIyVE81LVMwMV9WQUxFTkNFX0NIQU5HRS1MMS1HIiwwLDEsMSwiQ++8mjDku7fihpIrMuS7t++8m1Bi77yaKzLku7fihpIw5Lu3Il0sWyJSRURPWC0yMDI2MDgxMy1WMS1SMlRPNS1TMDFfVkFMRU5DRV9DSEFOR0UtTDEtSCIsMCwxLDEsIkPvvJow5Lu34oaSKzLku7fvvJtTbu+8mis05Lu34oaSMOS7tyJdLFsiUkVET1gtMjAyNjA4MTMtVjEtUjJUTzUtUzAyX0VMRUNUUk9OX0RJUkVDVElPTi1MMS1DIiwxLDEsMSwi55S15a2Q55SxSOKCgui9rOWQkUN1TyJdLFsiUkVET1gtMjAyNjA4MTMtVjEtUjJUTzUtUzAyX0VMRUNUUk9OX0RJUkVDVElPTi1MMS1EIiwxLDEsMSwi55S15a2Q55SxQ+i9rOWQkUN1TyJdLFsiUkVET1gtMjAyNjA4MTMtVjEtUjJUTzUtUzAyX0VMRUNUUk9OX0RJUkVDVElPTi1MMS1FIiwxLDEsMSwi55S15a2Q55SxQ0/ovazlkJFGZeKCgk/igoMiXSxbIlJFRE9YLTIwMjYwODEzLVYxLVIyVE81LVMwMl9FTEVDVFJPTl9ESVJFQ1RJT04tTDEtRiIsMSwxLDEsIueUteWtkOeUsUNP6L2s5ZCRTk8iXSxbIlJFRE9YLTIwMjYwODEzLVYxLVIyVE81LVMwMl9FTEVDVFJPTl9ESVJFQ1RJT04tTDEtRyIsMSwxLDEsIueUteWtkOeUsUPovazlkJFTaU/igoIiXSxbIlJFRE9YLTIwMjYwODEzLVYxLVIyVE81LVMwMl9FTEVDVFJPTl9ESVJFQ1RJT04tTDEtSCIsMSwxLDEsIueUteWtkOeUsUPovazlkJFQYk8iXSxbIlJFRE9YLTIwMjYwODEzLVYxLVIyVE81LVMwM19PWElESVpJTkdfQUdFTlQtTDEtQyIsMiwxLDEsIkN1wrLigboiXSxbIlJFRE9YLTIwMjYwODEzLVYxLVIyVE81LVMwM19PWElESVpJTkdfQUdFTlQtTDEtRCIsMiwxLDEsIkjigboiXSxbIlJFRE9YLTIwMjYwODEzLVYxLVIyVE81LVMwM19PWElESVpJTkdfQUdFTlQtTDEtRSIsMiwxLDEsIkFnTk/igoMiXSxbIlJFRE9Y",
  "LTIwMjYwODEzLVYxLVIyVE81LVMwM19PWElESVpJTkdfQUdFTlQtTDEtRiIsMiwxLDEsIkZlQ2zigoMiXSxbIlJFRE9YLTIwMjYwODEzLVYxLVIyVE81LVMwM19PWElESVpJTkdfQUdFTlQtTDEtRyIsMiwxLDEsIldP4oKDIl0sWyJSRURPWC0yMDI2MDgxMy1WMS1SMlRPNS1TMDNfT1hJRElaSU5HX0FHRU5ULUwxLUgiLDIsMSwxLCJQYk8iXSxbIlJFRE9YLTIwMjYwODEzLVYxLVIyVE81LVMwNF9SRURVQ0lOR19BR0VOVC1MMS1DIiwzLDEsMSwiRmUiXSxbIlJFRE9YLTIwMjYwODEzLVYxLVIyVE81LVMwNF9SRURVQ0lOR19BR0VOVC1MMS1EIiwzLDEsMSwiSOKCgiJdLFsiUkVET1gtMjAyNjA4MTMtVjEtUjJUTzUtUzA0X1JFRFVDSU5HX0FHRU5ULUwxLUUiLDMsMSwxLCJDdSJdLFsiUkVET1gtMjAyNjA4MTMtVjEtUjJUTzUtUzA0X1JFRFVDSU5HX0FHRU5ULUwxLUYiLDMsMSwxLCJDdSJdLFsiUkVET1gtMjAyNjA4MTMtVjEtUjJUTzUtUzA0X1JFRFVDSU5HX0FHRU5ULUwxLUciLDMsMSwxLCJDIl0sWyJSRURPWC0yMDI2MDgxMy1WMS1SMlRPNS1TMDRfUkVEVUNJTkdfQUdFTlQtTDEtSCIsMywxLDEsIkMiXSxbIlJFRE9YLTIwMjYwODEzLVYxLVIyVE81LVMwNV9PWElESVpFRF9TVUJTVEFOQ0UtTDEtQyIsNCwxLDEsIlpuIl0sWyJSRURPWC0yMDI2MDgxMy1WMS1SMlRPNS1TMDVfT1hJRElaRURfU1VCU1RBTkNFLUwxLUQiLDQsMSwxLCJGZSJdLFsiUkVET1gtMjAyNjA4MTMtVjEtUjJUTzUtUzA1X09YSURJWkVEX1NVQlNUQU5DRS1MMS1FIiw0LDEsMSwiQWwiXSxbIlJFRE9YLTIwMjYwODEzLVYxLVIyVE81LVMwNV9PWElESVpFRF9TVUJTVEFOQ0UtTDEtRiIsNCwxLDEsIkN1Il0sWyJSRURPWC0yMDI2MDgxMy1WMS1SMlRPNS1TMDVfT1hJRElaRURfU1VCU1RBTkNFLUwxLUciLDQsMSwxLCJDIl0sWyJSRURPWC0yMDI2MDgxMy1WMS1SMlRPNS1TMDVfT1hJRElaRURfU1VCU1RBTkNFLUwxLUgiLDQsMSwxLCJI4oKCIl0sWyJSRURPWC0yMDI2MDgxMy1WMS1SMlRPNS1TMDZfUkVEVUNFRF9TVUJTVEFOQ0UtTDEtQyIsNSwxLDEsIkN1wrLigboiXSxbIlJFRE9YLTIwMjYwODEzLVYxLVIyVE81LVMwNl9SRURVQ0VEX1NVQlNUQU5DRS1MMS1EIiw1LDEsMSwiSOKBuiJdLFsiUkVET1gtMjAyNjA4MTMtVjEtUjJUTzUtUzA2X1JFRFVDRURfU1VCU1RBTkNFLUwxLUUiLDUsMSwxLCJDdU8iXSxbIlJFRE9YLTIwMjYwODEzLVYxLVIyVE81LVMwNl9SRURVQ0VEX1NVQlNUQU5DRS1MMS1GIiw1LDEsMSwiQWdOT+KCgyJdLFsiUkVET1gtMjAyNjA4MTMtVjEtUjJUTzUtUzA2X1JFRFVDRURfU1VCU1RBTkNFLUwxLUciLDUsMSwxLCJTaU/igoIiXSxbIlJFRE9YLTIwMjYwODEzLVYxLVIyVE81LVMwNl9SRURVQ0VEX1NVQlNUQU5DRS1MMS1IIiw1LDEsMSwiUGJPIl0sWyJSRURPWC0yMDI2MDgxMy1WMS1SMlRPNS1TMDdfT1hJREFUSU9OX1BST0RVQ1QtTDEtQyIsNiwxLDEsIlpuwrLigboiXSxbIlJFRE9YLTIwMjYwODEzLVYxLVIyVE81LVMwN19PWElEQVRJT05fUFJPRFVDVC1MMS1EIiw2LDEsMSwiRmXCsuKBuiJdLFsiUkVET1gtMjAyNjA4MTMtVjEtUjJUTzUtUzA3X09YSURBVElPTl9QUk9EVUNULUwxLUUiLDYsMSwxLCJBbOKCgk/igoMiXSxbIlJFRE9YLTIwMjYwODEzLVYxLVIyVE81LVMwN19PWElEQVRJT05fUFJPRFVDVC1MMS1GIiw2LDEsMSwiQ3VDbOKCgiJdLFsiUkVET1gtMjAyNjA4MTMtVjEtUjJUTzUtUzA3X09YSURBVElPTl9QUk9EVUNULUwxLUciLDYsMSwxLCJDTyJdLFsiUkVET1gtMjAyNjA4MTMtVjEtUjJUTzUtUzA3X09YSURBVElPTl9QUk9EVUNULUwxLUgiLDYsMSwxLCJI4oKCTyJdLFsiUkVET1gtMjAyNjA4MTMtVjEtUjJUTzUtUzA4X1JFRFVDVElPTl9QUk9EVUNULUwxLUMiLDcsMSwxLCJDdSJdLFsiUkVET1gtMjAyNjA4MTMtVjEtUjJUTzUtUzA4X1JFRFVDVElPTl9QUk9EVUNULUwxLUQiLDcsMSwxLCJDdSJdLFsiUkVET1gtMjAyNjA4MTMtVjEtUjJUTzUtUzA4X1JFRFVDVElPTl9QUk9EVUNULUwxLUUiLDcsMSwxLCJBZyJdLFsiUkVET1gtMjAyNjA4MTMtVjEtUjJUTzUtUzA4X1JFRFVDVElPTl9QUk9EVUNULUwxLUYiLDcsMSwxLCJUaSJdLFsiUkVET1gtMjAyNjA4MTMtVjEtUjJUTzUtUzA4X1JFRFVDVElPTl9QUk9EVUNULUwxLUciLDcsMSwxLCJXIl0sWyJSRURPWC0yMDI2MDgxMy1WMS1SMlRPNS1TMDhfUkVEVUNUSU9OX1BST0RVQ1QtTDEtSCIsNywxLDEsIlBiIl0sWyJSRURPWC0yMDI2MDgxMy1WMS1SMlRPNS1TMDlfRUxFQ1RST05fQU1PVU5ULUwxLUMiLDgsMSwxLCIwLjQwIG1vbCJdLFsiUkVET1gtMjAyNjA4MTMtVjEtUjJUTzUtUzA5X0VMRUNUUk9OX0FNT1VOVC1MMS1EIiw4LDEsMSwiMC4zMCBtb2wiXSxbIlJFRE9YLTIwMjYwODEzLVYxLVIyVE81LVMwOV9FTEVDVFJPTl9BTU9VTlQtTDEtRSIsOCwxLDEsIjAuODAgbW9sIl0sWyJSRURPWC0yMDI2MDgxMy1WMS1SMlRPNS1TMDlfRUxFQ1RST05fQU1PVU5ULUwxLUYiLDgsMSwxLCIxLjUwIG1vbCJdLFsiUkVET1gtMjAyNjA4MTMtVjEtUjJUTzUtUzA5X0VMRUNUUk9OX0FNT1VOVC1MMS1HIiw4LDEsMSwiMC42MCBtb2wiXSxbIlJFRE9YLTIwMjYwODEzLVYxLVIyVE81LVMwOV9FTEVDVFJPTl9BTU9VTlQtTDEtSCIsOCwxLDEsIjEuNDAgbW9sIl0sWyJSRURPWC0yMDI2MDgxMy1WMS1SMlRPNS1TMTBfQ09OU0VSVkFUSU9OX0FQUExJQ0FUSU9OLUwxLUMiLDksMSwxLCLlpLHnlLXlrZAwLjIwIG1vbO+8m+W+l+eUteWtkDAuMjAgbW9sIl0sWyJSRURPWC0yMDI2MDgxMy1WMS1SMlRPNS1TMTBfQ09OU0VSVkFUSU9OX0FQUExJQ0FUSU9OLUwxLUQiLDksMSwxLCLlpLHnlLXlrZAwLjMwIG1vbO+8m+W+l+eUteWtkDAuMzAgbW9sIl0sWyJSRURPWC0yMDI2MDgxMy1WMS1SMlRPNS1TMTBfQ09OU0VSVkFUSU9OX0FQUExJQ0FUSU9OLUwxLUUiLDksMSwxLCLlpLHnlLXlrZAwLjQwIG1vbO+8m+W+l+eUteWtkDAuNDAgbW9sIl0sWyJSRURPWC0yMDI2MDgxMy1WMS1SMlRPNS1TMTBfQ09OU0VSVkFUSU9OX0FQUExJQ0FUSU9OLUwxLUYiLDksMSwxLCLlpLHnlLXlrZAwLjUwIG1vbO+8m+W+l+eUteWtkDAuNTAgbW9sIl0sWyJSRURPWC0yMDI2MDgxMy1WMS1SMlRPNS1TMTBfQ09OU0VSVkFUSU9OX0FQUExJQ0FUSU9OLUwxLUciLDksMSwxLCLlpLHnlLXlrZAwLjYwIG1vbO+8m+W+l+eUteWtkDAuNjAgbW9sIl0sWyJSRURPWC0yMDI2MDgxMy1WMS1SMlRPNS1TMTBfQ09OU0VSVkFUSU9OX0FQUExJQ0FUSU9OLUwxLUgiLDksMSwxLCLlpLHnlLXlrZAwLjcwIG1vbO+8m+W+l+eUteWtkDAuNzAgbW9sIl0sWyJSRURPWC0yMDI2MDgxMy1WMS1SMS0wMDEiLDAsMSwwLCJabu+8mjDihpIrMu+8m0N177yaKzLihpIwIl0sWyJSRURPWC0yMDI2MDgxMy1WMS1SMS0wMDIiLDEsMSwwLCLnlLXlrZDnlLFGZei9rOenu+e7mUjigboiXSxbIlJFRE9YLTIwMjYwODEzLVYxLVIxLTAwMyIsMiwxLDAsIkN1TyJdLFsiUkVET1gtMjAyNjA4MTMtVjEtUjEtMDA0IiwzLDEsMCwiQ08iXSxbIlJFRE9YLTIwMjYwODEzLVYxLVIxLTAwNSIsNCwxLDAsIkMiXSxbIlJFRE9YLTIwMjYwODEzLVYxLVIxLTAwNiIsNSwxLDAsIkZl4oKCT+KCgyJdLFsiUkVET1gtMjAyNjA4MTMtVjEtUjEtMDA3Iiw2LDEsMCwiRmVTT+KChCJdLFsiUkVET1gtMjAyNjA4MTMtVjEtUjEtMDA4Iiw3LDEsMCwiQ3UiXSxbIlJFRE9YLTIwMjYwODEzLVYxLVIxLTAwOSIsOCwyLDAsIjAuNjAgbW9sIl0sWyJSRURPWC0yMDI2MDgxMy1WMS1SMS0wMTAiLDgsMiwwLCIxLjAwIG1vbCJdLFsiUkVET1gtMjAyNjA4MTMtVjEtUjEtMDExIiw5LDIsMCwiMC42MCBtb2wiXSxbIlJFRE9YLTIwMjYwODEzLVYxLVIxLTAxMiIsOSwyLDAsIjAuNDAgbW9sIl0sWyJSRURPWC0yMDI2MDgxMy1WMS1SMS0wMTMiLDYsMiwwLCIwLjQ1IG1vbO+8mzAuOTAgbW9sIl0sWyJSRURPWC0yMDI2MDgxMy1WMS1SMS0wMTQiLDAsMSwwLCLkuI3lsZ7kuo7vvIzlm6DkuLrlj43lupTliY3lkI7lkITlhYPntKDljJblkIjku7flnYfmnKrmlLnlj5giXSxbIlJFRE9YLTIwMjYwODEzLVYxLVIxLTAxNSIsOCwyLDAsIjMuMCBtb2wiXSxbIlJFRE9YLTIwMjYwODEzLVYxLVIxLTAxNiIsOSwyLDAsIjAuMjAgbW9s77ybNi40IGciXSxbIlJFRE9YLTIwMjYwODEzLVYxLVIxLTAxNyIsOSwyLDAsIjIuNDHDlzEwwrLCsyJdXQ=="
].join("");
const REDOX_QUESTION_MANIFEST = new Map<string, RedoxQuestionManifest>(
  (JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(REDOX_MANIFEST_B64), (char) => char.charCodeAt(0)))) as [string, number, number, number, string][])
    .map(([id, tagIndex, level, adaptive, correctAnswer]) => [id, { id, tag: REDOX_SKILLS[tagIndex], level, adaptive: adaptive === 1, correctAnswer }])
);
const REDOX_FIRST_ROUND_IDS = new Set(
  Array.from(REDOX_QUESTION_MANIFEST.values()).filter((question) => !question.adaptive).map((question) => question.id)
);

function cors(origin: string | null) {
  const safe = origin && (allowedOrigins.has(origin) || origin.startsWith("http://localhost:") || origin.startsWith("http://127.0.0.1:")) ? origin : "https://ganlu6633-source.github.io";
  return {
    "Access-Control-Allow-Origin": safe,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin"
  };
}
function reply(origin: string | null, status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors(origin), "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }
  });
}
function normalizeName(value: unknown) {
  return String(value ?? "").normalize("NFKC").trim().replace(/\s+/g, "").toLowerCase();
}
function text(value: unknown, max = 300) {
  return String(value ?? "").trim().slice(0, max);
}
async function sha256(value: string) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}
function randomToken() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}
async function loadProfile(studentId: string, displayName: string) {
  const now = new Date().toISOString();
  const [{ data, error }, { data: assignments, error: assignmentError }] = await Promise.all([
    db.from("quiz_sessions")
      .select("client_session_id,day,round,assessment_key,school_class,correct_count,total_count,total_sec,answers,completed_at")
      .eq("student_id", studentId)
      .order("completed_at", { ascending: false })
      .limit(250),
    db.from("quiz_assessment_assignments")
      .select("assessment_key")
      .eq("student_id", studentId)
      .eq("active", true)
      .lte("opens_at", now)
      .or(`closes_at.is.null,closes_at.gt.${now}`)
  ]);
  if (error) throw error;
  if (assignmentError) throw assignmentError;
  const orderedRows = (data ?? []).slice().reverse();
  const sessions = orderedRows.map((row: any) => ({
    clientSessionId: row.client_session_id,
    day: row.day,
    round: row.round,
    assessmentKey: row.assessment_key || "",
    date: new Date(row.completed_at).toLocaleDateString("zh-CN"),
    dateMs: new Date(row.completed_at).getTime(),
    correct: row.correct_count,
    total: row.total_count,
    totalSec: row.total_sec,
    answers: Array.isArray(row.answers) ? row.answers : []
  }));
  return {
    name: displayName,
    cls: orderedRows.length ? String(orderedRows[orderedRows.length - 1].school_class ?? "") : "",
    sessions,
    authorizedAssessmentKeys: (assignments ?? []).map((row: any) => row.assessment_key)
  };
}
async function hasAssessmentAccess(studentId: string, assessmentKey: string) {
  if (!assessmentKey) return false;
  const now = new Date().toISOString();
  const { data, error } = await db.from("quiz_assessment_assignments")
    .select("assessment_key")
    .eq("student_id", studentId)
    .eq("assessment_key", assessmentKey)
    .eq("active", true)
    .lte("opens_at", now)
    .or(`closes_at.is.null,closes_at.gt.${now}`)
    .maybeSingle();
  if (error) throw error;
  return Boolean(data);
}
async function verifiedStudent(normalizedName: string, token: string) {
  if (!normalizedName || !token || token.length < 30) return null;
  const tokenHash = await sha256(token);
  const now = new Date().toISOString();
  const { data: device } = await db
    .from("student_devices")
    .select("id,student_id,expires_at,revoked_at")
    .eq("token_hash", tokenHash)
    .is("revoked_at", null)
    .gt("expires_at", now)
    .maybeSingle();
  if (!device) return null;
  const { data: student } = await db
    .from("students")
    .select("id,display_name,normalized_name,active")
    .eq("id", device.student_id)
    .eq("normalized_name", normalizedName)
    .eq("active", true)
    .maybeSingle();
  if (!student) return null;
  await db.from("student_devices").update({ last_seen_at: now }).eq("id", device.id);
  return student;
}
async function updateMastery(studentId: string, answers: any[]) {
  const grouped = new Map<string, { total: number; correct: number; sec: number; wrong: number; slow: number; level: number }>();
  for (const a of answers) {
    const tag = text(a.tag, 80);
    if (!tag) continue;
    const g = grouped.get(tag) ?? { total: 0, correct: 0, sec: 0, wrong: 0, slow: 0, level: 1 };
    const sec = Math.max(1, Math.min(3600, Number(a.sec) || 1));
    g.total += 1;
    g.correct += a.ok ? 1 : 0;
    g.wrong += a.ok ? 0 : 1;
    g.slow += sec >= 45 ? 1 : 0;
    g.sec += sec;
    g.level = Math.max(g.level, Math.min(4, Number(a.level) || 1));
    grouped.set(tag, g);
  }
  const tags = Array.from(grouped.keys());
  if (!tags.length) return;
  const { data: current } = await db
    .from("student_mastery")
    .select("*")
    .eq("student_id", studentId)
    .in("tag", tags);
  const old = new Map((current ?? []).map((r: any) => [r.tag, r]));
  const rows = tags.map((tag) => {
    const g = grouped.get(tag)!;
    const o: any = old.get(tag);
    return {
      student_id: studentId,
      tag,
      correct_count: (o?.correct_count ?? 0) + g.correct,
      total_count: (o?.total_count ?? 0) + g.total,
      total_sec: (o?.total_sec ?? 0) + g.sec,
      wrong_count: (o?.wrong_count ?? 0) + g.wrong,
      slow_count: (o?.slow_count ?? 0) + g.slow,
      highest_level: Math.max(o?.highest_level ?? 1, g.level),
      last_seen_at: new Date().toISOString()
    };
  });
  const { error } = await db.from("student_mastery").upsert(rows, { onConflict: "student_id,tag" });
  if (error) throw error;
}
function cleanAnswers(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 30).map((a: any) => ({
    id: text(a?.id, 80),
    day: Math.max(1, Math.min(15, Number(a?.day) || 1)),
    tag: text(a?.tag, 80),
    level: Math.max(1, Math.min(4, Number(a?.level) || 1)),
    sourceModel: text(a?.sourceModel, 180),
    q: text(a?.q, 800),
    ok: Boolean(a?.ok),
    sec: Math.max(1, Math.min(3600, Number(a?.sec) || 1)),
    mine: text(a?.mine, 500),
    correctAnswer: text(a?.correctAnswer, 500),
    explanation: text(a?.explanation, 1200)
  }));
}
function inferredAssessmentKey(day: number, answers: any[]) {
  const ids = answers.map((answer) => text(answer?.id, 80));
  if (ids.length && ids.every((id) => id.startsWith("APPCALC-"))) return "mole-application-v3";
  if (ids.length && ids.every((id) => id.startsWith("GMV-"))) return "gas-molar-volume-v2";
  if (ids.length && ids.every((id) => /^(MM|MN|MNN|MOL|NA)-/.test(id))) return "mole-basics-v1";
  if (ids.length && ids.every((id) => id.startsWith("REDOX-"))) return REDOX_ASSESSMENT_KEY;
  return `legacy-day-${day}`;
}
function authoritativeRedoxAnswers(rawAnswers: unknown, round: number) {
  if (!Array.isArray(rawAnswers) || rawAnswers.length !== 17) return null;
  const rebuilt = [];
  const ids = new Set<string>();
  for (const raw of rawAnswers) {
    if (!raw || typeof raw !== "object" || !Number.isInteger(Number(raw.day)) || Number(raw.day) !== REDOX_DAY ||
        !Number.isInteger(Number(raw.level)) || typeof raw.mine !== "string" ||
        typeof raw.ok !== "boolean" || typeof raw.id !== "string" || typeof raw.tag !== "string" ||
        !Number.isFinite(Number(raw.sec)) || Number(raw.sec) < 1 || Number(raw.sec) > 3600) return null;
    const manifest = REDOX_QUESTION_MANIFEST.get(raw.id);
    if (!manifest || ids.has(raw.id) || manifest.tag !== raw.tag || manifest.level !== Number(raw.level) ||
        (round === 1 ? manifest.adaptive : !manifest.adaptive)) return null;
    ids.add(raw.id);
    const mine = text(raw.mine, 500);
    const sec = Math.max(1, Math.min(3600, Number(raw.sec) || 1));
    rebuilt.push({
      id: manifest.id,
      day: REDOX_DAY,
      tag: manifest.tag,
      level: manifest.level,
      sourceModel: text(raw.sourceModel, 180),
      q: text(raw.q, 800),
      ok: mine === manifest.correctAnswer,
      sec,
      mine,
      correctAnswer: manifest.correctAnswer,
      explanation: text(raw.explanation, 1200)
    });
  }
  if (round === 1 && (ids.size !== REDOX_FIRST_ROUND_IDS.size || Array.from(REDOX_FIRST_ROUND_IDS).some((id) => !ids.has(id)))) return null;
  return rebuilt;
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("Origin");
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors(origin) });
  if (req.method !== "POST") return reply(origin, 405, { error: "method_not_allowed" });
  if (origin && !allowedOrigins.has(origin) && !origin.startsWith("http://localhost:") && !origin.startsWith("http://127.0.0.1:")) {
    return reply(origin, 403, { error: "origin_not_allowed" });
  }

  try {
    const body = await req.json();
    const action = text(body?.action, 40);
    const normalizedName = normalizeName(body?.name);
    if (!normalizedName || normalizedName.length < 2 || normalizedName.length > 30) {
      return reply(origin, 400, { error: "invalid_name", message: "请输入完整姓名。" });
    }

    if (action === "login") {
      const pin = String(body?.pin ?? "");
      if (!/^\d{4}$/.test(pin)) return reply(origin, 400, { error: "invalid_pin", message: "请输入4位学习码。" });

      const rawIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
      const ipHash = await sha256(rawIp);
      const since = new Date(Date.now() - 15 * 60 * 1000).toISOString();
      const [{ count: nameFailures }, { count: ipFailures }] = await Promise.all([
        db.from("login_attempts").select("id", { count: "exact", head: true }).eq("normalized_name", normalizedName).eq("success", false).gte("attempted_at", since),
        db.from("login_attempts").select("id", { count: "exact", head: true }).eq("ip_hash", ipHash).eq("success", false).gte("attempted_at", since)
      ]);
      if ((nameFailures ?? 0) >= 8 || (ipFailures ?? 0) >= 20) {
        return reply(origin, 429, { error: "too_many_attempts", message: "尝试次数过多，请15分钟后再试。" });
      }

      const { data, error } = await db.rpc("verify_student_pin", { p_normalized_name: normalizedName, p_pin: pin });
      const student = !error && Array.isArray(data) ? data[0] : null;
      await db.from("login_attempts").insert({ normalized_name: normalizedName, ip_hash: ipHash, success: Boolean(student) });
      if (!student) return reply(origin, 401, { error: "invalid_credentials", message: "姓名或学习码不正确。" });

      const rememberDevice = body?.rememberDevice === true;
      const token = randomToken();
      const tokenHash = await sha256(token);
      await db.from("student_devices").insert({
        student_id: student.student_id,
        token_hash: tokenHash,
        device_label: rememberDevice ? "连续3次同一姓名的受信任网页" : "当前网页临时训练会话",
        remember_device: rememberDevice,
        expires_at: new Date(Date.now() + (rememberDevice ? 120 * 24 * 60 * 60 * 1000 : 8 * 60 * 60 * 1000)).toISOString()
      });
      const profile = await loadProfile(student.student_id, student.display_name);
      return reply(origin, 200, { ok: true, token, remembered: rememberDevice, profile });
    }

    const token = text(body?.token, 200);
    const student: any = await verifiedStudent(normalizedName, token);
    if (!student) return reply(origin, 401, { error: "session_expired", message: "请重新输入姓名和学习码。" });

    if (action === "load") {
      return reply(origin, 200, { ok: true, profile: await loadProfile(student.id, student.display_name) });
    }

    if (action === "save_session") {
      const session = body?.session ?? {};
      const day = Number(session.day);
      const round = Number(session.round);
      const correct = Number(session.correct);
      const total = Number(session.total);
      const totalSec = Number(session.totalSec);
      const requestedAssessmentKey = text(session.assessmentKey, 80);
      if (!Number.isInteger(day) || day < 1 || day > 15 ||
          !Number.isInteger(round) || round < 1 || round > 50 ||
          !Number.isInteger(total) || total < 1 || total > 30 ||
          !Number.isInteger(correct) || correct < 0 || correct > total ||
          !Number.isFinite(totalSec) || totalSec < 1 || totalSec > 86400) {
        return reply(origin, 400, { error: "invalid_session", message: "训练记录格式不正确。" });
      }
      let answers = cleanAnswers(session.answers);
      if (answers.length !== total) return reply(origin, 400, { error: "answer_count_mismatch", message: "答题数量不一致。" });
      const assessmentKey = inferredAssessmentKey(day, answers);
      if (requestedAssessmentKey && requestedAssessmentKey !== assessmentKey) {
        return reply(origin, 400, { error: "assessment_mismatch", message: "训练主题与题目记录不一致。" });
      }
      if (assessmentKey === REDOX_ASSESSMENT_KEY) {
        const authorized = await hasAssessmentAccess(student.id, assessmentKey);
        const authoritative = authoritativeRedoxAnswers(session.answers, round);
        const validRedox = authorized && day === REDOX_DAY && round <= 5 && total === 17 && authoritative &&
          authoritative.every((answer: any) => REDOX_TAGS.has(answer.tag));
        if (!validRedox) return reply(origin, 403, { error: "assessment_not_allowed", message: "该专项小测未向当前学生开放，或记录校验未通过。" });
        answers = authoritative;
      } else if (day === REDOX_DAY) {
        return reply(origin, 403, { error: "assessment_not_allowed", message: "专项小测记录缺少授权标识。" });
      }
      const clientSessionId = text(session.clientSessionId, 100) || crypto.randomUUID();
      const { data: existing } = await db
        .from("quiz_sessions")
        .select("id")
        .eq("student_id", student.id)
        .eq("client_session_id", clientSessionId)
        .maybeSingle();

      if (!existing) {
        if (assessmentKey === REDOX_ASSESSMENT_KEY) {
          const { count, error: roundError } = await db.from("quiz_sessions")
            .select("id", { count: "exact", head: true })
            .eq("student_id", student.id)
            .eq("assessment_key", REDOX_ASSESSMENT_KEY);
          if (roundError) throw roundError;
          if (round !== (count ?? 0) + 1) return reply(origin, 409, { error: "round_out_of_sequence", message: "专项轮次与后台记录不一致，请重新读取后继续。" });
        }
        const wrongTags = Array.from(new Set(answers.filter((a: any) => !a.ok).map((a: any) => a.tag).filter(Boolean)));
        const slowTags = Array.from(new Set(answers.filter((a: any) => a.sec >= 45).map((a: any) => a.tag).filter(Boolean)));
        const authoritativeCorrect = answers.filter((answer: any) => answer.ok).length;
        const authoritativeTotalSec = answers.reduce((sum: number, answer: any) => sum + answer.sec, 0);
        const completedMs = Number(session.dateMs);
        const completedAt = assessmentKey === REDOX_ASSESSMENT_KEY
          ? new Date().toISOString()
          : Number.isFinite(completedMs) && completedMs > 0 && completedMs < Date.now() + 86400000
            ? new Date(completedMs).toISOString()
            : new Date().toISOString();
        const { error } = await db.from("quiz_sessions").insert({
          student_id: student.id,
          client_session_id: clientSessionId,
          day,
          round,
          assessment_key: assessmentKey,
          training_theme: assessmentKey === REDOX_ASSESSMENT_KEY ? "氧化还原反应基础与电子守恒" : text(session.trainingTheme, 160),
          school_class: text(session.schoolClass, 100),
          correct_count: authoritativeCorrect,
          total_count: answers.length,
          total_sec: Math.round(authoritativeTotalSec),
          answers,
          wrong_tags: wrongTags,
          slow_tags: slowTags,
          habit_signal: text(session.habitSignal, 300),
          difficulty_signal: text(session.difficultySignal, 300),
          completed_at: completedAt
        });
        if (error) throw error;
        await updateMastery(student.id, answers);
      }
      return reply(origin, 200, { ok: true, profile: await loadProfile(student.id, student.display_name) });
    }

    if (action === "logout") {
      const tokenHash = await sha256(token);
      await db.from("student_devices").update({ revoked_at: new Date().toISOString() }).eq("token_hash", tokenHash);
      return reply(origin, 200, { ok: true });
    }

    return reply(origin, 400, { error: "unknown_action" });
  } catch (error) {
    console.error(error);
    return reply(origin, 500, { error: "server_error", message: "后台暂时不可用，请稍后重试。" });
  }
});
