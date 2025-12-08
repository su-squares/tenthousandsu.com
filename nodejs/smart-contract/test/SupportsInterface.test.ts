import { expect } from "chai";
import { deploySupportsInterfaceTestMock } from "./helpers/deploy";

describe("SupportsInterface", function () {
    let subject: Awaited<ReturnType<typeof deploySupportsInterfaceTestMock>>;

    beforeEach(async function () {
        subject = await deploySupportsInterfaceTestMock();
    });

    describe("Baseline behavior", function () {
        it("should support ERC-165 interface", async function () {
            const theInterface = "0x01ffc9a7";
            const supports = await subject.supportsInterface(theInterface);
            expect(supports).to.equal(true);
        });

        it("should not support 0xffffffff interface", async function () {
            const theInterface = "0xffffffff";
            const supports = await subject.supportsInterface(theInterface);
            expect(supports).to.equal(false);
        });
    });

    describe("Add a new interface", function () {
        it("should add and recognize new interface", async function () {
            const theInterface = "0xba5eba11";

            // Initially should not support
            let supports = await subject.supportsInterface(theInterface);
            expect(supports).to.equal(false);

            // Add the interface
            await subject.setInterface(theInterface);

            // Now should support
            supports = await subject.supportsInterface(theInterface);
            expect(supports).to.equal(true);
        });
    });
});
