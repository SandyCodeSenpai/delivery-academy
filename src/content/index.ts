import type { Chapter, PartMeta } from "./types";
import ch00 from "./ch00";
import ch01 from "./ch01";
import ch02 from "./ch02";
import ch03 from "./ch03";
import ch04 from "./ch04";
import ch05 from "./ch05";
import ch06 from "./ch06";
import ch07 from "./ch07";
import ch08 from "./ch08";
import ch09 from "./ch09";
import ch10 from "./ch10";
import ch11 from "./ch11";
import ch12 from "./ch12";
import ch13 from "./ch13";
import ch14 from "./ch14";
import ch15 from "./ch15";
import ch16 from "./ch16";
import ch17 from "./ch17";
import ch18 from "./ch18";
import ch19 from "./ch19";
export const CHAPTERS: Chapter[] = [ch00, ch01, ch02, ch03, ch04, ch05, ch06, ch07, ch08, ch09, ch10, ch11, ch12, ch13, ch14, ch15, ch16, ch17, ch18, ch19];
export const PARTS: PartMeta[] = [
  {
    "id": 0,
    "name": "Start here",
    "blurb": "How the course works and the running example."
  },
  {
    "id": 1,
    "name": "The whole picture",
    "blurb": "Every component from studio file to screen."
  },
  {
    "id": 2,
    "name": "Foundations",
    "blurb": "Networks, DNS, HTTP, TLS and caching rules."
  },
  {
    "id": 3,
    "name": "The delivery stack",
    "blurb": "CDN internals, origins and shields, packaging, protection."
  },
  {
    "id": 4,
    "name": "Steering and the client",
    "blurb": "Choosing a CDN per viewer, and the player's view."
  },
  {
    "id": 5,
    "name": "Running it",
    "blurb": "Observability, reliability, premieres, IaC, security, cost."
  },
  {
    "id": 6,
    "name": "Putting it together",
    "blurb": "How the giants do it, the capstone design, staff thinking."
  }
];
export { GLOSSARY } from "./glossary";
