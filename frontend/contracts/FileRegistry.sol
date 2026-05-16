// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract FileRegistry {

    struct File {
        address owner;
        string  ipfsCID;
        address signerAddress;
        uint256 timestamp;
        bool    exists;
    }

    mapping(string  => File)     private files;
    mapping(address => string[]) private userFiles;

    event FileRegistered(
        string  fileHash,
        string  ipfsCID,
        address owner,
        address signer,
        uint256 timestamp
    );

    // Updated with ipfsCID and automatic signer tracking
    function registerFile(string calldata fileHash, string calldata ipfsCID) external {
        require(!files[fileHash].exists, "File already registered");
        files[fileHash] = File({
            owner:         msg.sender,
            ipfsCID:       ipfsCID,
            signerAddress: msg.sender,
            timestamp:     block.timestamp,
            exists:        true
        });
        userFiles[msg.sender].push(fileHash);
        emit FileRegistered(fileHash, ipfsCID, msg.sender, msg.sender, block.timestamp);
    }

    function verifyFile(string calldata fileHash)
        external view
        returns (bool valid, address owner, string memory ipfsCID, address signer, uint256 timestamp)
    {
        if (!files[fileHash].exists) {
            return (false, address(0), "", address(0), 0);
        }
        File memory f = files[fileHash];
        return (true, f.owner, f.ipfsCID, f.signerAddress, f.timestamp);
    }

    function getOwnerFiles(address user)
        external view
        returns (string[] memory)
    {
        return userFiles[user];
    }

    function fileExists(string calldata fileHash)
        external view
        returns (bool)
    {
        return files[fileHash].exists;
    }
}