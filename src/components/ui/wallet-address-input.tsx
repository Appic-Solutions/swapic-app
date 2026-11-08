import { Card } from '@/components/ui/card';
import { cn } from '@/lib/cn';
import React, { useEffect, useState } from 'react';
import { isEvmAddress, isIcpPrincipal } from '@/lib/validation';
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
      {/* the Send card's type and spacing (AmountCard), so the two read as one form */}
      <Card className="cursor-auto flex-col items-start justify-center gap-2 p-4 md:p-5 md:short:py-4 md:tiny:gap-1 md:tiny:py-3">
        <p className="text-xs font-medium text-secondary md:text-sm">Send To Wallet</p>
        <div className="flex w-full items-center gap-3 md:gap-4">
          <div className="relative">
            <Avatar src={avatar} className="h-9 w-9 md:h-12 md:w-12" />
          </div>
          <div className="relative w-full min-w-0">
            <input
              type="text"
              maxLength={token?.chain_type === 'ICP' ? 63 : 42}
              placeholder={token?.chain_type === 'ICP' ? 'Enter ICP address' : 'Enter EVM address'}
              value={address}
              onChange={handleAddressChange}
              className={cn(
                'w-full bg-transparent py-1 font-medium text-primary outline-none',
                // the same placeholder as the amount's: the card's own type, faint
                'placeholder:text-xl placeholder:font-semibold placeholder:text-faint md:placeholder:text-2xl',
                '[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none',
                address.length > 45 ? 'text-xs md:text-sm' : 'text-base md:text-lg',
              )}
            />
          </div>
        </div>
        {/* an empty field is not a mistake yet: the line holds its place so the card never jumps */}
        <p className="-mt-1 min-h-4 pl-12 text-xs font-normal leading-4 text-warn md:pl-16">{address ? validationError : ''}</p>
      </Card>
    </div>
  );
};

export default WalletAddressInput;
