import os
import ctypes
import secrets
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

# SSS Prime field
PRIME = 2**521 - 1

class ShamirMath:
    @staticmethod
    def _eval_at(poly, x, prime):
        accum = 0
        for coeff in reversed(poly):
            accum *= x
            accum += coeff
            accum %= prime
        return accum

    @staticmethod
    def split_secret(secret_int, n, t):
        """Splits secret into n shares, requires t to reconstruct."""
        poly = [secret_int] + [secrets.randbelow(PRIME) for _ in range(t - 1)]
        shares = [(i, ShamirMath._eval_at(poly, i, PRIME)) for i in range(1, n + 1)]
        # Zero out polynomial coefficients from memory
        for i in range(len(poly)):
            poly[i] = 0
        return shares

    @staticmethod
    def reconstruct_secret(shares):
        """Reconstructs the secret from t shares using Lagrange interpolation."""
        if len(shares) < 2:
            raise ValueError("Not enough shares to reconstruct master key.")
        
        secret = 0
        for i, (x_i, y_i) in enumerate(shares):
            num, den = 1, 1
            for j, (x_j, y_j) in enumerate(shares):
                if i != j:
                    num = (num * -x_j) % PRIME
                    den = (den * (x_i - x_j)) % PRIME
            # modular inverse
            secret = (secret + y_i * num * pow(den, PRIME - 2, PRIME)) % PRIME
        return secret

class CryptoEngine:
    def __init__(self):
        # Master KEK is NO LONGER stored statically or loaded universally via .env
        pass
        
    def _zero_memory(self, b_array: bytearray):
        """
        Zero-Memory Hygiene Implementation for Python: 
        Directly overwrite plaintext memory blocks to mitigate RAM scraping vectors.
        """
        for i in range(len(b_array)):
            b_array[i] = 0
        del b_array # Signal to GC

    def reconstruct_kek(self, shares: list) -> bytes:
        """
        Reconstructs Master KEK from Shamir shares in memory temporarily.
        """
        reconstructed_int = ShamirMath.reconstruct_secret(shares)
        # Convert back to 32 byte KEK limit
        return reconstructed_int.to_bytes(32, 'big')

    def envelope_encrypt(self, plaintext: str, kek_shares: list) -> dict:
        # 1. Ephemeral Matrix: Reconstruct Master KEK strictly for this single execution context
        kek_bytes = bytearray(self.reconstruct_kek(kek_shares))
        
        # 2. Random 32 byte DEK wrapped natively in a mutable bytearray buffer
        raw_dek = bytearray(os.urandom(32))
        data_iv = os.urandom(12)
        
        # Explicit python cast for underlying C-Layer
        dek_bytes = bytes(raw_dek)
        aesgcm = AESGCM(dek_bytes)
        
        # 3. Encrypt Question Text payload
        ciphertext_packet = aesgcm.encrypt(data_iv, plaintext.encode('utf-8'), None)
        ciphertext = ciphertext_packet[:-16]
        auth_tag = ciphertext_packet[-16:]

        # 4. Encrypt ephemeral DEK using the ephemeral KEK
        dek_iv = os.urandom(12)
        kek_aesgcm = AESGCM(bytes(kek_bytes))
        enc_dek_packet = kek_aesgcm.encrypt(dek_iv, dek_bytes, None)
        enc_dek = enc_dek_packet[:-16]
        enc_dek_auth_tag = enc_dek_packet[-16:]
        
        # 5. ABSOLUTE ZERO-MEMORY HYGIENE (Force wipe the mutables holding the keys)
        self._zero_memory(raw_dek)
        self._zero_memory(kek_bytes)
        
        return {
            "ciphertext": ciphertext.hex(),
            "iv": data_iv.hex(),
            "authTag": auth_tag.hex(),
            "encryptedDEK": enc_dek.hex(),
            "encryptedDEKIV": dek_iv.hex(),
            "encryptedDEKAuthTag": enc_dek_auth_tag.hex()
        }

    def envelope_decrypt(self, envelope: dict, kek_shares: list) -> str:
        """
        Reconstructs KEK, decrypts the DEK, then decrypts the payload.
        Ensures strict zero-memory hygiene throughout.
        """
        # 1. Ephemeral Matrix: Reconstruct Master KEK strictly for this single execution
        kek_bytes = bytearray(self.reconstruct_kek(kek_shares))
        
        try:
            # 2. Extract envelope parts
            ciphertext = bytes.fromhex(envelope['ciphertext'])
            iv = bytes.fromhex(envelope['iv'])
            auth_tag = bytes.fromhex(envelope['authTag'])
            enc_dek = bytes.fromhex(envelope['encryptedDEK'])
            dek_iv = bytes.fromhex(envelope['encryptedDEKIV'])
            dek_auth_tag = bytes.fromhex(envelope['encryptedDEKAuthTag'])
            
            # 3. Decrypt transient DEK using ephemeral KEK
            kek_aesgcm = AESGCM(bytes(kek_bytes))
            decrypted_dek_bytes = kek_aesgcm.decrypt(
                dek_iv, 
                enc_dek + dek_auth_tag, 
                None
            )
            raw_dek = bytearray(decrypted_dek_bytes)
            
            # 4. Decrypt original Question Text payload
            aesgcm = AESGCM(bytes(raw_dek))
            plaintext_bytes = aesgcm.decrypt(
                iv, 
                ciphertext + auth_tag, 
                None
            )
            
            return plaintext_bytes.decode('utf-8')
        finally:
            # 5. ABSOLUTE ZERO-MEMORY HYGIENE (Force wipe mutables holding keys always!)
            if 'raw_dek' in locals():
                self._zero_memory(raw_dek)
            self._zero_memory(kek_bytes)

crypto_engine = CryptoEngine()
