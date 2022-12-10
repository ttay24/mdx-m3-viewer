import BinaryStream from "../../../common/binarystream";
import Modification from "./modification";

/**
 * A modified object.
 */
export default class ModifiedObject {
  oldId = "\0\0\0\0";
  newId = "\0\0\0\0";
  modifications: Modification[] = [];

  skipBytes?: number;
  skippyBuffer?: string;

  load(stream: BinaryStream, useOptionalInts: boolean, version: number): void {
    this.oldId = stream.readBinary(4);
    this.newId = stream.readBinary(4);

    // if using version 3 (introduced in 1.33), then we need to read these bytes and skip
    // some of this stuff to match the spec
    if (version >= 3) {
      this.skipBytes = stream.readUint32();
      this.skippyBuffer = stream.readBinary(4 * this.skipBytes);
    }

    // read the number of files
    const numModifications = stream.readUint32();
    for (let i = 0; i < numModifications; i++) {
      const modification = new Modification();

      modification.load(stream, useOptionalInts);

      this.modifications[i] = modification;
    }
  }

  save(stream: BinaryStream, useOptionalInts: boolean, version: number): void {
    if (this.oldId !== "\0\0\0\0") {
      stream.writeBinary(this.oldId);
    } else {
      stream.writeUint32(0);
    }

    if (this.newId !== "\0\0\0\0") {
      stream.writeBinary(this.newId);
    } else {
      stream.writeUint32(0);
    }

    if (version >= 3 && this.skipBytes && this.skippyBuffer) {
      stream.writeUint32(this.skipBytes);
      stream.writeBinary(this.skippyBuffer);
    }

    stream.writeUint32(this.modifications.length);

    for (const modification of this.modifications) {
      modification.save(stream, useOptionalInts);
    }
  }

  getByteLength(useOptionalInts: boolean): number {
    let size = 12;

    for (const modification of this.modifications) {
      size += modification.getByteLength(useOptionalInts);
    }

    return size;
  }
}
