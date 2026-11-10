// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IERC20Market {
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function transfer(address to, uint256 amount) external returns (bool);
}
interface IERC721Market {
    function transferFrom(address from, address to, uint256 tokenId) external;
}

/// @title OreMarket — ORE-priced escrowed soldier NFT market.
contract OreMarket {
    IERC20Market public immutable ore;
    IERC721Market public immutable nft;
    uint256 public nextListingId = 1;

    struct Listing {
        address seller;
        uint256 tokenId;
        uint256 price;
        bool active;
    }
    mapping(uint256 => Listing) public listings;

    event Listed(uint256 indexed listingId, address indexed seller, uint256 indexed tokenId, uint256 price);
    event Sold(uint256 indexed listingId, address indexed buyer, address indexed seller, uint256 tokenId, uint256 price);
    event Cancelled(uint256 indexed listingId, address indexed seller, uint256 tokenId);

    constructor(address token, address collection) {
        require(token != address(0) && collection != address(0), "address");
        ore = IERC20Market(token);
        nft = IERC721Market(collection);
    }

    function list(uint256 tokenId, uint256 price) external returns (uint256 id) {
        require(price > 0, "price");
        nft.transferFrom(msg.sender, address(this), tokenId);
        id = nextListingId++;
        listings[id] = Listing(msg.sender, tokenId, price, true);
        emit Listed(id, msg.sender, tokenId, price);
    }

    function buy(uint256 id) external {
        Listing storage l = listings[id];
        require(l.active, "inactive");
        require(msg.sender != l.seller, "seller");
        l.active = false;
        require(ore.transferFrom(msg.sender, l.seller, l.price), "ore");
        nft.transferFrom(address(this), msg.sender, l.tokenId);
        emit Sold(id, msg.sender, l.seller, l.tokenId, l.price);
    }

    function cancel(uint256 id) external {
        Listing storage l = listings[id];
        require(l.active && l.seller == msg.sender, "not seller");
        l.active = false;
        nft.transferFrom(address(this), msg.sender, l.tokenId);
        emit Cancelled(id, msg.sender, l.tokenId);
    }
}
