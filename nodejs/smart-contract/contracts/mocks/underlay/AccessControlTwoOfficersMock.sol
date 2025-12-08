// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "../../underlay/AccessControlTwoOfficers.sol";

/// @title Mock for testing AccessControlTwoOfficers with payable receive
contract AccessControlTwoOfficersMock is AccessControlTwoOfficers {
    receive() external payable {}
}
