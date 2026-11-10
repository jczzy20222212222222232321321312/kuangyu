// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
interface IERC20P { function transfer(address,uint256) external returns(bool); }
contract OreMinePoolV2 {
    IERC20P public immutable ore;
    address public signer;
    bytes32 private constant DOMAIN_TYPEHASH = keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)");
    bytes32 private constant CLAIM_TYPEHASH = keccak256("Claim(address player,uint256 amount,uint256 nonce,uint256 deadline)");
    bytes32 private immutable DOMAIN_SEPARATOR;
    mapping(address => mapping(uint256 => bool)) public used;
    event Claimed(address indexed player, uint256 amount, uint256 nonce);
    constructor(address token, address signer_) {
        require(token != address(0) && signer_ != address(0), "address");
        ore = IERC20P(token); signer = signer_;
        DOMAIN_SEPARATOR = keccak256(abi.encode(DOMAIN_TYPEHASH, keccak256("OreMinePoolV2"), keccak256("1"), block.chainid, address(this)));
    }
    function claim(uint256 amount, uint256 nonce, uint256 deadline, bytes calldata signature) external {
        require(amount > 0, "amount"); require(deadline >= block.timestamp, "expired"); require(!used[msg.sender][nonce], "nonce");
        bytes32 structHash = keccak256(abi.encode(CLAIM_TYPEHASH, msg.sender, amount, nonce, deadline));
        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", DOMAIN_SEPARATOR, structHash));
        require(_recover(digest, signature) == signer, "signature");
        used[msg.sender][nonce] = true;
        require(ore.transfer(msg.sender, amount), "transfer");
        emit Claimed(msg.sender, amount, nonce);
    }
    function _recover(bytes32 digest, bytes calldata signature) internal pure returns (address) {
        require(signature.length == 65, "len"); bytes32 r; bytes32 s; uint8 v;
        assembly { r := calldataload(signature.offset) s := calldataload(add(signature.offset,32)) v := byte(0,calldataload(add(signature.offset,64))) }
        if (v < 27) v += 27; require(v==27||v==28,"v"); address a=ecrecover(digest,v,r,s); require(a!=address(0),"rec"); return a;
    }
}
