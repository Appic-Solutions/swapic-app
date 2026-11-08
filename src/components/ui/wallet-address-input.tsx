import { Card } from '@/components/ui/card';
import { cn } from '@/lib/cn';
import React, { useEffect, useState } from 'react';
import { isEvmAddress, isIcpPrincipal, isSolanaAddress } from '@/lib/validation';
import { Avatar } from '@/components/ui/avatar';
import type { UiToken } from './token-types';

interface WalletAddressInputProps {
  token: UiToken | undefined;
  address: string;
  setAddress: (address: string) => void;
  validationError: string;
  onValidationError: (error: string) => void;
  onWalletAddressChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  show: boolean;
  avatar: string;
}

const WalletAddressInput = ({
  token,
  address,
  setAddress,
  validationError,
  onValidationError,
  onWalletAddressChange,
  show,
  avatar,
}: WalletAddressInputProps) => {
  const [inputValue, setInputValue] = useState<string>('');
  const validateWalletAddress = (address: string) => {
    if (!token) return false;
    if (!address) {
      onValidationError?.('Wallet Address cannot be empty');
      return false;
    }

    if (token?.chain_type === 'ICP') {
      const isValid = isIcpPrincipal(address);
      if (!isValid) {
        onValidationError?.('ICP Wallet Address is not valid');
        return false;
      }
    } else if (token?.chain_type === 'SOLANA') {
      if (!isSolanaAddress(address)) {
        onValidationError?.('Solana Wallet Address is not valid');
        return false;
      }
    } else {
      const isValid = isEvmAddress(address);
      if (!isValid) {
        onValidationError?.('EVM Wallet Address is not valid');
        return false;
      }
    }
    onValidationError?.('');
    return true;
  };

  useEffect(() => {
    validateWalletAddress(inputValue);
  }, [token, onValidationError, inputValue]);

  const handleAddressChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
    setAddress(e.target.value);
    onWalletAddressChange?.(e);
  };

  return (
    <div
      className={cn(
        'overflow-hidden transition-[max-height] duration-200 ease-in-out',
        show ? 'mt-4 max-h-[155px]' : 'max-h-0',
      )}
    >
      <Card
        className={cn(
          'max-h-[133px] cursor-auto flex-col items-start justify-center gap-y-2 md:max-h-[155px]',
        )}
      >
        <p className="text-sm font-semibold">Send To Wallet</p>
        <div className="flex w-full items-center gap-4">
          <div className="relative">
            <Avatar src={avatar} className="h-12 w-12" />
          </div>
          <div className="relative w-full">
            <input
              type="text"
              maxLength={token?.chain_type === 'ICP' ? 63 : token?.chain_type === 'SOLANA' ? 44 : 42}
              placeholder={token?.chain_type === 'ICP' ? '2vxsx-fae...' : '0x0f70e...65A63'}
              value={address}
              onChange={handleAddressChange}
              className={cn(
                'w-full py-2 outline-none',
                'bg-transparent text-primary',
                'placeholder:text-faint',
                '[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none',
                address.length > 30 && 'text-lg',
              )}
            />
            {validationError && (
              <p className="absolute top-[50px] animate-slide-in-from-top text-xs text-warn">
                {validationError}
              </p>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
};

export default WalletAddressInput;
