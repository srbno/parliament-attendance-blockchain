// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract AttendanceRegistry {
    struct Record {
        uint256 id;
        bytes32 hash;
    }

    Record[] private records;

    function addRecord(
        uint256 _id,
        bytes32 _hash
    ) external {
        records.push(
            Record({
                id: _id,
                hash: _hash
            })
        );
    }

    function getRecord(uint256 index)
    external
    view
    returns (Record memory)
    {
        require(index < records.length, "Invalid index");
        return records[index];
    }

    function getTotalRecords()
    external
    view
    returns (uint256)
    {
        return records.length;
    }
}