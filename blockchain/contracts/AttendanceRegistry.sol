// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.20;

contract AttendanceRegistry {
    struct Record {
        bytes32 nameHash;
        bytes32 locationHash;
        address submittedBy;
        uint256 timestamp;
    }

    Record[] public records;

    function addRecord(bytes32 _nameHash, bytes32 _locationHash) public {
        records.push(Record({
            nameHash: _nameHash,
            locationHash: _locationHash,
            submittedBy: msg.sender,
            timestamp: block.timestamp
        }));
    }

    function getRecord(uint256 index) public view returns (Record memory) {
        return records[index];
    }
}