// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/*
 * Ore Soldier — BSC Testnet free-mint test collection.
 * Total supply: 10,000. Maximum 10 per wallet, lifetime.
 * No paid mint, no owner reserve, no hidden allocation.
 */
contract OreSoldierV6 {
    string public constant name = "Ore Soldier";
    string public constant symbol = "ORSOL";
    uint256 public constant MAX_SUPPLY = 10_000;
    uint256 public constant MAX_PER_WALLET = 10000;
    uint256 public constant RECRUIT_FEE = 100_000_000; // 0.0000000001 BNB in wei
    address public feeRecipient;
    address public signer;
    mapping(address => mapping(uint256 => bool)) public usedRecruitNonces;

    address public owner;
    string private _baseTokenURI;
    uint256 private _nextTokenId = 1;
    uint256 private _totalSupply;

    struct SoldierData {
        uint16 atk;
        uint16 def;
        uint16 spd;
        uint16 gen;
        uint16 power;
        uint32 fatherId;
        uint32 motherId;
        uint16 factor;
        uint64 bornAt;
        string cls;
    }
    mapping(uint256 => SoldierData) public soldiers;
    event SoldierMinted(uint256 indexed tokenId, address indexed to, uint16 atk, uint16 def, uint16 spd, uint16 gen, uint16 power, uint32 fatherId, uint32 motherId, uint16 factor);


    mapping(uint256 => address) private _owners;
    mapping(address => uint256) private _balances;
    mapping(address => uint256) private _minted;
    mapping(uint256 => address) private _tokenApprovals;
    mapping(address => mapping(address => bool)) private _operatorApprovals;

    event Transfer(address indexed from, address indexed to, uint256 indexed tokenId);
    event Approval(address indexed owner, address indexed approved, uint256 indexed tokenId);
    event ApprovalForAll(address indexed owner, address indexed operator, bool approved);
    event BaseURIChanged(string uri);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    error NotOwner();
    error ZeroAddress();
    error InvalidQuantity();
    error WalletLimit();
    error SoldOut();
    error NonexistentToken();
    error NotAuthorized();
    error WrongFrom();
    error UnsafeRecipient();

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    constructor(string memory baseURI_) {
        owner = msg.sender;
        signer = msg.sender;
        feeRecipient = msg.sender;
        _baseTokenURI = baseURI_;
        emit OwnershipTransferred(address(0), msg.sender);
    }

    /// Owner-only migration for existing game NFTs. IDs are preserved.
    function migrate(address[] calldata tos, uint256[] calldata ids) external onlyOwner {
        require(tos.length == ids.length && tos.length > 0, "length");
        for (uint256 i = 0; i < tos.length; i++) {
            address to = tos[i];
            uint256 id = ids[i];
            require(to != address(0), "zero");
            require(id > 0 && id <= MAX_SUPPLY, "id");
            require(_owners[id] == address(0), "minted");
            _owners[id] = to;
            _balances[to]++;
            _minted[to]++;
            _totalSupply++;
            if (id >= _nextTokenId) _nextTokenId = id + 1;
            emit Transfer(address(0), to, id);
            _checkOnERC721Received(address(0), to, id, "");
        }
    }

    /* ----------------------------- mint ----------------------------- */

    function mint() external {
        _mintMany(msg.sender, 1);
    }

    function mint(uint256 quantity) external {
        _mintMany(msg.sender, quantity);
    }

    function _mintMany(address to, uint256 quantity) internal {
        if (to == address(0)) revert ZeroAddress();
        if (quantity == 0 || quantity > MAX_PER_WALLET) revert InvalidQuantity();
        if (_minted[to] + quantity > MAX_PER_WALLET) revert WalletLimit();
        if (_totalSupply + quantity > MAX_SUPPLY) revert SoldOut();

        for (uint256 i = 0; i < quantity; i++) {
            uint256 tokenId = _nextTokenId++;
            _totalSupply++;
            _owners[tokenId] = to;
            _balances[to]++;
            _minted[to]++;
            emit Transfer(address(0), to, tokenId);
            _checkOnERC721Received(address(0), to, tokenId, "");
        }
    }

    /* ------------------------- game mint ------------------------- */
    function _store(uint256 id, SoldierData calldata d) internal {
        soldiers[id] = d;
        emit SoldierMinted(id, _owners[id], d.atk, d.def, d.spd, d.gen, d.power, d.fatherId, d.motherId, d.factor);
    }

    function mintTo(address to, SoldierData calldata d) external onlyOwner returns (uint256 id) {
        if (to == address(0)) revert ZeroAddress();
        if (_totalSupply + 1 > MAX_SUPPLY) revert SoldOut();
        id = _nextTokenId++;
        _totalSupply++;
        _owners[id] = to;
        _balances[to]++;
        _minted[to]++;
        emit Transfer(address(0), to, id);
        _store(id, d);
        _checkOnERC721Received(address(0), to, id, "");
    }

    function mintChild(address to, SoldierData calldata d) external onlyOwner returns (uint256 id) {
        if (to == address(0)) revert ZeroAddress();
        require(d.fatherId != 0 && d.motherId != 0, "parents");
        require(_owners[d.fatherId] == to && _owners[d.motherId] == to, "parent owner");
        if (_totalSupply + 1 > MAX_SUPPLY) revert SoldOut();
        id = _nextTokenId++;
        _totalSupply++;
        _owners[id] = to;
        _balances[to]++;
        _minted[to]++;
        emit Transfer(address(0), to, id);
        _store(id, d);
        _checkOnERC721Received(address(0), to, id, "");
    }

    function migrateWithData(address to, uint256 id, SoldierData calldata d) external onlyOwner {
        require(to != address(0) && id > 0 && id <= MAX_SUPPLY, "args");
        require(_owners[id] == address(0), "minted");
        _owners[id] = to;
        _balances[to]++;
        _minted[to]++;
        _totalSupply++;
        if (id >= _nextTokenId) _nextTokenId = id + 1;
        emit Transfer(address(0), to, id);
        _store(id, d);
        _checkOnERC721Received(address(0), to, id, "");
    }

    function setSigner(address next) external onlyOwner {
        require(next != address(0), "signer");
        signer = next;
    }

    function setFeeRecipient(address next) external onlyOwner {
        require(next != address(0), "fee");
        feeRecipient = next;
    }

    function recruitHash(address to, SoldierData calldata d, uint256 nonce, uint256 deadline) public view returns (bytes32) {
        return keccak256(abi.encode(address(this), block.chainid, to, nonce, deadline, keccak256(abi.encode(d))));
    }

    function _recover(bytes32 digest, bytes memory signature) internal pure returns (address) {
        require(signature.length == 65, "signature");
        bytes32 r; bytes32 s; uint8 v;
        assembly { r := mload(add(signature, 32)) s := mload(add(signature, 64)) v := byte(0, mload(add(signature, 96))) }
        if (v < 27) v += 27;
        require(v == 27 || v == 28, "v");
        address a = ecrecover(digest, v, r, s);
        require(a != address(0), "recover");
        return a;
    }

    /// Player-paid recruit NFT. Attributes must be signed by the game signer.
    function mintPaid(SoldierData calldata d, uint256 nonce, uint256 deadline, bytes calldata signature) external payable returns (uint256 id) {
        require(msg.value == RECRUIT_FEE, "fee");
        require(deadline >= block.timestamp, "expired");
        require(!usedRecruitNonces[msg.sender][nonce], "nonce");
        bytes32 digest = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", recruitHash(msg.sender, d, nonce, deadline)));
        require(_recover(digest, signature) == signer, "signature");
        usedRecruitNonces[msg.sender][nonce] = true;
        if (_totalSupply + 1 > MAX_SUPPLY) revert SoldOut();
        id = _nextTokenId++;
        _totalSupply++;
        _owners[id] = msg.sender;
        _balances[msg.sender]++;
        _minted[msg.sender]++;
        emit Transfer(address(0), msg.sender, id);
        _store(id, d);
        _checkOnERC721Received(address(0), msg.sender, id, "");
        if (RECRUIT_FEE > 0) { (bool ok,) = feeRecipient.call{value: RECRUIT_FEE}(""); require(ok, "fee transfer"); }
    }

    /// Player-paid birth mint: gas only, no BNB fee. Birth ORE fee is handled by the server.
    function mintChildPaid(SoldierData calldata d, uint256 nonce, uint256 deadline, bytes calldata signature) external returns (uint256 id) {
        require(deadline >= block.timestamp, "expired");
        require(!usedRecruitNonces[msg.sender][nonce], "nonce");
        bytes32 digest = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", recruitHash(msg.sender, d, nonce, deadline)));
        require(_recover(digest, signature) == signer, "signature");
        usedRecruitNonces[msg.sender][nonce] = true;
        if (_totalSupply + 1 > MAX_SUPPLY) revert SoldOut();
        id = _nextTokenId++;
        _totalSupply++;
        _owners[id] = msg.sender;
        _balances[msg.sender]++;
        _minted[msg.sender]++;
        emit Transfer(address(0), msg.sender, id);
        _store(id, d);
        _checkOnERC721Received(address(0), msg.sender, id, "");
    }

    function recruitBatchHash(address to, SoldierData[] calldata ds, uint256 nonce, uint256 deadline) public view returns (bytes32) {
        return keccak256(abi.encode(address(this), block.chainid, to, nonce, deadline, keccak256(abi.encode(ds))));
    }

    function mintPaidBatch(SoldierData[] calldata ds, uint256 nonce, uint256 deadline, bytes calldata signature) external payable returns (uint256) {
        uint256 n = ds.length;
        require(n > 0 && n <= 20, "count");
        require(msg.value == RECRUIT_FEE * n, "fee");
        require(deadline >= block.timestamp, "expired");
        require(!usedRecruitNonces[msg.sender][nonce], "nonce");
        bytes32 digest = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", recruitBatchHash(msg.sender, ds, nonce, deadline)));
        require(_recover(digest, signature) == signer, "signature");
        usedRecruitNonces[msg.sender][nonce] = true;
        require(_totalSupply + n <= MAX_SUPPLY, "sold out");
        for (uint256 i = 0; i < n; i++) {
            uint256 id = _nextTokenId++;
            _totalSupply++;
            _owners[id] = msg.sender;
            _balances[msg.sender]++;
            _minted[msg.sender]++;
            emit Transfer(address(0), msg.sender, id);
            _store(id, ds[i]);
            _checkOnERC721Received(address(0), msg.sender, id, "");
        }
        if (RECRUIT_FEE > 0) { (bool ok,) = feeRecipient.call{value: msg.value}(""); require(ok, "fee transfer"); }
        return _nextTokenId - 1;
    }

    /* --------------------------- metadata --------------------------- */

    function totalSupply() external view returns (uint256) {
        return _totalSupply;
    }

    function totalMinted() external view returns (uint256) {
        return _totalSupply;
    }

    function remaining() external view returns (uint256) {
        return MAX_SUPPLY - _totalSupply;
    }

    function walletMinted(address wallet) external view returns (uint256) {
        return _minted[wallet];
    }

    function baseURI() external view returns (string memory) {
        return _baseTokenURI;
    }

    function setBaseURI(string calldata uri) external onlyOwner {
        _baseTokenURI = uri;
        emit BaseURIChanged(uri);
    }

    function tokenURI(uint256 tokenId) external view returns (string memory) {
        _requireOwned(tokenId);
        if (bytes(_baseTokenURI).length == 0) return "";
        return string.concat(_baseTokenURI, _toString(tokenId));
    }

    function tokensOfOwner(address wallet) external view returns (uint256[] memory ids) {
        uint256 n = _balances[wallet];
        ids = new uint256[](n);
        uint256 cursor;
        for (uint256 id = 1; id < _nextTokenId && cursor < n; id++) {
            if (_owners[id] == wallet) ids[cursor++] = id;
        }
    }

    /* ----------------------------- ERC721 ---------------------------- */

    function balanceOf(address wallet) public view returns (uint256) {
        if (wallet == address(0)) revert ZeroAddress();
        return _balances[wallet];
    }

    function ownerOf(uint256 tokenId) public view returns (address) {
        return _requireOwned(tokenId);
    }

    function approve(address to, uint256 tokenId) external {
        address tokenOwner = _requireOwned(tokenId);
        if (msg.sender != tokenOwner && !isApprovedForAll(tokenOwner, msg.sender)) revert NotAuthorized();
        _tokenApprovals[tokenId] = to;
        emit Approval(tokenOwner, to, tokenId);
    }

    function getApproved(uint256 tokenId) external view returns (address) {
        _requireOwned(tokenId);
        return _tokenApprovals[tokenId];
    }

    function setApprovalForAll(address operator, bool approved) external {
        if (operator == msg.sender) revert NotAuthorized();
        _operatorApprovals[msg.sender][operator] = approved;
        emit ApprovalForAll(msg.sender, operator, approved);
    }

    function isApprovedForAll(address tokenOwner, address operator) public view returns (bool) {
        return _operatorApprovals[tokenOwner][operator];
    }

    function transferFrom(address from, address to, uint256 tokenId) public {
        if (from != _requireOwned(tokenId)) revert WrongFrom();
        if (to == address(0)) revert ZeroAddress();
        if (msg.sender != from && !isApprovedForAll(from, msg.sender) && _tokenApprovals[tokenId] != msg.sender) revert NotAuthorized();

        delete _tokenApprovals[tokenId];
        _balances[from]--;
        _balances[to]++;
        _owners[tokenId] = to;
        emit Transfer(from, to, tokenId);
    }

    function safeTransferFrom(address from, address to, uint256 tokenId) external {
        safeTransferFrom(from, to, tokenId, "");
    }

    function safeTransferFrom(address from, address to, uint256 tokenId, bytes memory data) public {
        transferFrom(from, to, tokenId);
        _checkOnERC721Received(from, to, tokenId, data);
    }

    function _requireOwned(uint256 tokenId) internal view returns (address tokenOwner) {
        tokenOwner = _owners[tokenId];
        if (tokenOwner == address(0)) revert NonexistentToken();
    }

    function _checkOnERC721Received(address from, address to, uint256 tokenId, bytes memory data) private {
        if (to.code.length == 0) return;
        try IERC721Receiver(to).onERC721Received(msg.sender, from, tokenId, data) returns (bytes4 ret) {
            if (ret != IERC721Receiver.onERC721Received.selector) revert UnsafeRecipient();
        } catch {
            revert UnsafeRecipient();
        }
    }

    function supportsInterface(bytes4 interfaceId) external pure returns (bool) {
        return interfaceId == 0x01ffc9a7 // ERC165
            || interfaceId == 0x80ac58cd // ERC721
            || interfaceId == 0x5b5e139f; // ERC721Metadata
    }

    /* ---------------------------- ownership -------------------------- */

    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert ZeroAddress();
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }

    function renounceOwnership() external onlyOwner {
        emit OwnershipTransferred(owner, address(0));
        owner = address(0);
    }

    /* ----------------------------- utils ----------------------------- */

    function _toString(uint256 value) internal pure returns (string memory) {
        if (value == 0) return "0";
        uint256 temp = value;
        uint256 digits;
        while (temp != 0) { digits++; temp /= 10; }
        bytes memory buffer = new bytes(digits);
        while (value != 0) {
            digits--;
            buffer[digits] = bytes1(uint8(48 + value % 10));
            value /= 10;
        }
        return string(buffer);
    }
}

interface IERC721Receiver {
    function onERC721Received(address operator, address from, uint256 tokenId, bytes calldata data) external returns (bytes4);
}
