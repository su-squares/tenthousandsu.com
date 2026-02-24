pragma solidity ^0.4.24;
import "../primary/SupportsInterface.sol";

contract SupportsInterfaceTestMock is SupportsInterface {
    constructor() public {}

    function setInterface(bytes4 newInterface) external {
        supportedInterfaces[newInterface] = true;
    }
}
