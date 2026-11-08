import { Card } from '@/components/ui/card';
import { cn } from '@/lib/cn';
import React, { useEffect, useState } from 'react';
import { isEvmAddress, isIcpPrincipal } from '@/lib/validation';
import { Avatar } from '@/components/ui/avatar';
import { WalletIcon } from '@/components/icons';
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
      {/* the Send card's type and spacing (AmountCard), so the two read as one form: the label (and, at its right, the
          address's error once one is typed; an empty field is not a mistake yet), then a wallet mark with the chain's badge
          beside the address. Two rows, nothing reserved empty, and the card keeps one height when an error comes and goes */}
      <Card className="cursor-auto flex-col items-stretch gap-3 p-4 md:p-5 md:short:gap-2 md:short:py-4 md:tiny:gap-1.5 md:tiny:py-3">
        <div className="flex w-full items-center justify-between gap-3 text-xs font-medium md:text-sm">
          <p className="shrink-0 text-secondary">Send to wallet</p>
          {address && validationError && <p key={validationError} className="min-w-0 animate-slide-in-from-top truncate font-normal text-warn">{validationError}</p>}
        </div>
        <div className="flex w-full items-center gap-3 md:gap-4">
          <div className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/[0.06] text-secondary md:h-12 md:w-12">
            <WalletIcon width={20} height={20} />
            <Avatar src={avatar} className="absolute -bottom-1 -right-1 h-4 w-4 ring-2 ring-[#18181a] md:h-5 md:w-5" />
          </div>
          <input
            type="text"
            maxLength={token?.chain_type === 'ICP' ? 63 : 42}
            placeholder={token?.chain_type === 'ICP' ? 'Enter ICP address' : 'Enter EVM address'}
            value={address}
            onChange={handleAddressChange}
            spellCheck={false}
            autoComplete="off"
            className={cn(
              'h-8 w-full min-w-0 bg-transparent font-medium text-primary outline-none',
              // the amount's placeholder: light and a step under the card's own size
              'placeholder:text-lg placeholder:font-normal placeholder:text-faint md:placeholder:text-xl',
              // a whole EVM address fits the card's width; an ICP principal (up to 63) a size down
              address.length > 45 ? 'text-xs md:text-sm' : 'text-sm md:text-base',
            )}
          />
        </div>
      </Card>
    </div>
  );
};

export default WalletAddressInput;
