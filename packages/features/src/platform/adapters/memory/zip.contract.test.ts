import { describeZipContract } from "../../ports/zip.contract";
import { decodeTestZip } from "../fflate/testing/zip";
import { createMemoryZip } from "./zip";

describeZipContract("memory Zip", createMemoryZip, decodeTestZip);
