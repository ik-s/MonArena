// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title BattleArena
 * @dev 모나드 테스트넷 배틀 아레나 보상 시스템
 * 사용자가 배틀에 참여하고 관리자의 서명을 통해 안전하게 보상을 클레임할 수 있습니다.
 */
contract BattleArena {
    address public owner;
    address public signer; // 서버(관리자)의 서명 지갑 주소

    mapping(address => uint256) public nonces; // 사용자별 중복 클레임 방지용 번호
    mapping(bytes => bool) public usedSignatures; // 사용된 서명 기록

    // EIP-712 도메인 구분자
    bytes32 public DOMAIN_SEPARATOR;
    bytes32 public constant CLAIM_TYPEHASH = keccak256("ClaimReward(address user,uint256 amount,uint256 nonce)");

    event BattleEntered(address indexed user, string battleId, uint256 amount);
    event RewardClaimed(address indexed user, uint256 amount, uint256 nonce);
    event SignerChanged(address oldSigner, address newSigner);

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner allowed");
        _;
    }

    constructor() {
        owner = msg.sender;
        // 사용자 요청에 따른 관리자 지갑 주소 고정
        signer = 0x5Fb66a14a77517519a8b0cb40B333F42e4718A65;

        uint256 chainId;
        assembly {
            chainId := chainid()
        }

        DOMAIN_SEPARATOR = keccak256(
            abi.encode(
                keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
                keccak256(bytes("BattleArena")),
                keccak256(bytes("1")),
                chainId,
                address(this)
            )
        );
    }

    /**
     * @dev 배틀 참여 함수
     * 현재 정책에 따라 참가비 체크를 하지 않고 무료로 진행합니다. (당분간 0 필터링)
     */
    function enterBattle(string calldata battleId) external payable {
        // 현재는 무료이므로 msg.value 제약 없음
        emit BattleEntered(msg.sender, battleId, msg.value);
    }

    /**
     * @dev 보상 클레임 함수 (EIP-712 서명 검증)
     * @param amount 보상 금액 (wei 단위)
     * @param nonce 사용자 nonce (중복 방지)
     * @param signature 서버에서 발행한 디지털 서명
     */
    function claimReward(uint256 amount, uint256 nonce, bytes calldata signature) external {
        require(!usedSignatures[signature], "Signature already used");
        require(nonce == nonces[msg.sender], "Invalid nonce");
        require(address(this).balance >= amount, "Insufficient contract balance");

        // 서명 검증을 위한 해시 생성
        bytes32 structHash = keccak256(
            abi.encode(CLAIM_TYPEHASH, msg.sender, amount, nonce)
        );
        bytes32 digest = keccak256(
            abi.encodePacked("\x19\x01", DOMAIN_SEPARATOR, structHash)
        );

        // 서명자 복원 및 검증
        address recoveredSigner = recoverSigner(digest, signature);
        require(recoveredSigner == signer, "Invalid signature");

        // 상태 업데이트 및 보상 지급
        usedSignatures[signature] = true;
        nonces[msg.sender]++;

        (bool success, ) = payable(msg.sender).call{value: amount}("");
        require(success, "Transfer failed");

        emit RewardClaimed(msg.sender, amount, nonce);
    }

    /**
     * @dev 서명 지갑 주소 변경
     */
    function setSigner(address _newSigner) external onlyOwner {
        address oldSigner = signer;
        signer = _newSigner;
        emit SignerChanged(oldSigner, _newSigner);
    }

    /**
     * @dev 컨트랙트 잔액 인출 (관리자용)
     */
    function withdraw() external onlyOwner {
        uint256 balance = address(this).balance;
        require(balance > 0, "No balance to withdraw");
        payable(owner).transfer(balance);
    }

    /**
     * @dev 헬퍼 함수: 서명자 복원
     */
    function recoverSigner(bytes32 digest, bytes memory signature) internal pure returns (address) {
        if (signature.length != 65) return address(0);

        bytes32 r;
        bytes32 s;
        uint8 v;

        assembly {
            r := mload(add(signature, 32))
            s := mload(add(signature, 64))
            v := byte(0, mload(add(signature, 96)))
        }

        if (v < 27) v += 27;
        if (v != 27 && v != 28) return address(0);

        return ecrecover(digest, v, r, s);
    }

    // MON 토큰 직접 전송 수납 허용
    receive() external payable {}
}
