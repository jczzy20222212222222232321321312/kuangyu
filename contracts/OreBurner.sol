// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IERC721Transfer {
    function transferFrom(address from, address to, uint256 tokenId) external;
}

/// @title OreBurner — batch-lock Ore Soldier NFTs into the dead address.
/// The player approves this contract once, then burns any number of tokens in one tx.
contract OreBurner {
    address public constant DEAD = 0x000000000000000000000000000000000000dEaD;
    address public immutable collection;

    event BatchBurned(address indexed player, uint256 count);

    constructor(address collection_) {
        require(collection_ != address(0), "collection");
        collection = collection_;
    }

    function burnBatch(uint256[] calldata tokenIds) external {
        require(tokenIds.length > 0 && tokenIds.length <= 500, "count");
        for (uint256 i = 0; i < tokenIds.length; i++) {
            IERC721Transfer(collection).transferFrom(msg.sender, DEAD, tokenIds[i]);
        }
        emit BatchBurned(msg.sender, tokenIds.length);
    }
}
