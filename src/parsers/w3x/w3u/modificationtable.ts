import BinaryStream from "../../../common/binarystream";
import ModifiedObject from "./modifiedobject";

/**
 * A modification table.
 */
export default class ModificationTable {
  objects: ModifiedObject[] = [];

  load(stream: BinaryStream, useOptionalInts: boolean, version: number): void {
    for (let i = 0, l = stream.readUint32(); i < l; i++) {
      const object = new ModifiedObject();

      object.load(stream, useOptionalInts, version);

      this.objects[i] = object;
    }
  }

  save(stream: BinaryStream, useOptionalInts: boolean, version: number): void {
    stream.writeUint32(this.objects.length);

    for (const object of this.objects) {
      object.save(stream, useOptionalInts, version);
    }
  }

  getByteLength(useOptionalInts: boolean): number {
    let size = 4;

    for (const object of this.objects) {
      size += object.getByteLength(useOptionalInts);
    }

    return size;
  }
}
