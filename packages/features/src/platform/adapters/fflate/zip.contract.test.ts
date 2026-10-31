import { unzipSync } from "fflate";
import { describeZipContract } from "../../ports/zip.contract";
import { createFflateZip } from "./zip";

describeZipContract("fflate Zip", createFflateZip, unzipSync);
