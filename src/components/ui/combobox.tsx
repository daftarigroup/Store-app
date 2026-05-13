import { useState } from 'react';

import {
    Command,
    CommandInput,
    CommandItem,
    CommandList,
    CommandGroup,
    CommandEmpty,
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Check, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';


type ComboboxProps = {
  multiple?: boolean;
  options: { label: string; value: string }[];
  value: string[];
  onChange: (val: string[]) => void;
  placeholder?: string;
};

export function ComboBox({
  multiple,
  options,
  value,
  onChange,
  placeholder = "Select option(s)",
}: ComboboxProps) {
  const [open, setOpen] = useState(false);

  const handleSelect = (val: string) => {
    if (multiple) {
      if (value.includes(val)) {
        onChange(value.filter((v) => v !== val));
      } else {
        onChange([...value, val]);
      }
    } else {
      onChange([val]);
      setOpen(false);
    }
  };

  const displayLabel = () => {
    if (value.length === 0) return placeholder;
    if (multiple) return `${value.length} selected`;
    return options.find((opt) => opt.value === value[0])?.label ?? placeholder;
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button 
          variant="outline" 
          role="combobox" 
          aria-expanded={open} 
          className={cn(
            "w-full justify-between h-10 px-3 border-slate-200/80 bg-white hover:bg-slate-50 transition-colors font-medium",
            value.length > 0 ? "text-foreground" : "text-muted-foreground"
          )}
        >
          <span className="truncate max-w-[150px]">{displayLabel()}</span>
          <ChevronsUpDown className="ml-2 h-3.5 w-3.5 opacity-40 shrink-0" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[200px] p-0">
        <Command>
          <CommandInput placeholder="Search..." />
          <CommandList>
            <CommandEmpty>No options found.</CommandEmpty>
            <CommandGroup>
              {options.map((opt) => (
                <CommandItem key={opt.value} value={opt.value} onSelect={() => handleSelect(opt.value)}>
                  <Check className={cn("mr-2 h-4 w-4", value.includes(opt.value) ? "opacity-100" : "opacity-0")} />
                  {opt.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
