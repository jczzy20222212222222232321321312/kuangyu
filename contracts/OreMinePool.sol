// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IERC20Mine {
    function transfer(address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

/// @title OreMinePool — 80,000,000 ORE emission reserve.
/// The game signer releases mined ORE into the vault at claim-time settlement.
contract OreMinePool {
    IERC20Mine public immutable ore;
    address public owner;
    address public signer;

    event Released(address indexed to, uint256 amount);
    event SignerChanged(address indexed signer);

    modifier onlySigner() {
        require(msg.sender == signer || msg.sender == owner, "signer");
        _;
    }

    constructor(address token, address signer_) {
        require(token != address(0) && signer_ != address(0), "address");
        ore = IERC20Mine(token);
        owner = msg.sender;
        signer = signer_;
    }

    function setSigner(address next) external {
        require(msg.sender == owner, "owner");
        require(next != address(0), "address");
        signer = next;
        emit SignerChanged(next);
    }

    function release(address to, uint256 amount) external onlySigner {
        require(amount > 0, "amount");
        require(ore.transfer(to, amount), "transfer");
        emit Released(to, amount);
    }

    function remaining() external view returns (uint256) {
        return ore.balanceOf(address(this));
    }
}
