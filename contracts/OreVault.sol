// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

/// @title OreVault — holds ORE and releases it against an EIP-712 claim signature.
/// The game server (signer) authorizes withdrawals. Users can also deposit ORE back.
contract OreVault {
    IERC20 public immutable ore;
    address public owner;
    address public signer;

    bytes32 private constant DOMAIN_TYPEHASH = keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)");
    bytes32 private constant CLAIM_TYPEHASH = keccak256("Claim(address player,uint256 amount,uint256 nonce,uint256 deadline)");
    bytes32 private immutable DOMAIN_SEPARATOR;

    mapping(address => mapping(uint256 => bool)) public usedClaims;

    event Claimed(address indexed player, uint256 amount, uint256 nonce);
    event Deposited(address indexed player, uint256 amount);
    event SignerChanged(address indexed signer);

    modifier onlyOwner() {
        require(msg.sender == owner, "owner");
        _;
    }

    constructor(address token, address signer_) {
        require(token != address(0) && signer_ != address(0), "address");
        ore = IERC20(token);
        owner = msg.sender;
        signer = signer_;
        DOMAIN_SEPARATOR = keccak256(abi.encode(
            DOMAIN_TYPEHASH,
            keccak256("OreVault"),
            keccak256("1"),
            block.chainid,
            address(this)
        ));
    }

    function setSigner(address next) external onlyOwner {
        require(next != address(0), "address");
        signer = next;
        emit SignerChanged(next);
    }

    function claim(uint256 amount, uint256 nonce, uint256 deadline, bytes calldata signature) external {
        require(amount > 0, "amount");
        require(deadline >= block.timestamp, "expired");
        require(!usedClaims[msg.sender][nonce], "nonce used");
        bytes32 structHash = keccak256(abi.encode(CLAIM_TYPEHASH, msg.sender, amount, nonce, deadline));
        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", DOMAIN_SEPARATOR, structHash));
        require(_recover(digest, signature) == signer, "signature");
        usedClaims[msg.sender][nonce] = true;
        require(ore.transfer(msg.sender, amount), "transfer");
        emit Claimed(msg.sender, amount, nonce);
    }

    /// Move ORE from the player's wallet into the vault; the off-chain game can
    /// credit the player's local personal treasury after this transaction.
    function deposit(uint256 amount) external {
        require(amount > 0, "amount");
        require(ore.transferFrom(msg.sender, address(this), amount), "transfer");
        emit Deposited(msg.sender, amount);
    }

    function _recover(bytes32 digest, bytes calldata signature) internal pure returns (address) {
        require(signature.length == 65, "signature length");
        bytes32 r;
        bytes32 s;
        uint8 v;
        assembly {
            r := calldataload(signature.offset)
            s := calldataload(add(signature.offset, 32))
            v := byte(0, calldataload(add(signature.offset, 64)))
        }
        if (v < 27) v += 27;
        require(v == 27 || v == 28, "v");
        address recovered = ecrecover(digest, v, r, s);
        require(recovered != address(0), "recover");
        return recovered;
    }
}
