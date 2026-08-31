import * as React from 'react';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';
import {
    Drawer,
    DrawerContent,
    DrawerDescription,
    DrawerFooter,
    DrawerHeader,
    DrawerTitle,
} from '@/components/ui/drawer';
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetFooter,
    SheetHeader,
    SheetTitle,
} from '@/components/ui/sheet';

type FormPanelVariant = 'drawer' | 'sheet';

const FormPanelContext = React.createContext<FormPanelVariant>('sheet');

function useFormPanelVariant() {
    return React.useContext(FormPanelContext);
}

type FormPanelProps = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    children: React.ReactNode;
    contentClassName?: string;
    showCloseButton?: boolean;
};

function isFormPanelPart(child: React.ReactNode, part: typeof FormPanelHeader | typeof FormPanelFooter) {
    return React.isValidElement(child) && child.type === part;
}

function splitFormPanelChildren(children: React.ReactNode) {
    const nodes = React.Children.toArray(children);
    let header: React.ReactNode = null;
    let footer: React.ReactNode = null;
    const body: React.ReactNode[] = [];

    for (const child of nodes) {
        if (isFormPanelPart(child, FormPanelHeader)) {
            header = child;
        } else if (isFormPanelPart(child, FormPanelFooter)) {
            footer = child;
        } else {
            body.push(child);
        }
    }

    return { header, body, footer };
}

function FormPanel({ open, onOpenChange, children, contentClassName, showCloseButton = true }: FormPanelProps) {
    const isMobile = useIsMobile();

    if (isMobile) {
        const { header, body, footer } = splitFormPanelChildren(children);

        return (
            <Drawer open={open} onOpenChange={onOpenChange} showSwipeHandle swipeHandleClassName="h-8 pt-2">
                <FormPanelContext.Provider value="drawer">
                    {/* ponytail: ignore contentClassName on mobile — sheets pass overflow-y-auto for desktop Sheet */}
                    <DrawerContent className="flex max-h-[92dvh] w-full flex-col gap-0 overflow-hidden p-0">
                        {header}
                        {body.length > 0 ? (
                            <div
                                data-base-ui-swipe-ignore
                                className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain touch-pan-y px-0 pb-4"
                            >
                                {body}
                            </div>
                        ) : null}
                        {footer ? (
                            <div className="shrink-0 border-t border-border bg-popover">{footer}</div>
                        ) : null}
                    </DrawerContent>
                </FormPanelContext.Provider>
            </Drawer>
        );
    }

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <FormPanelContext.Provider value="sheet">
                <SheetContent side="right" className={contentClassName} showCloseButton={showCloseButton}>
                    {children}
                </SheetContent>
            </FormPanelContext.Provider>
        </Sheet>
    );
}

function FormPanelHeader({ className, ...props }: React.ComponentProps<'div'>) {
    const variant = useFormPanelVariant();
    if (variant === 'drawer') {
        return <DrawerHeader className={cn('shrink-0 bg-popover', className)} {...props} />;
    }
    return <SheetHeader className={className} {...props} />;
}

function FormPanelFooter({ className, ...props }: React.ComponentProps<'div'>) {
    const variant = useFormPanelVariant();
    if (variant === 'drawer') {
        return (
            <DrawerFooter
                className={cn(
                    'gap-3 bg-popover p-0 px-4 pt-4',
                    className,
                    'pb-[max(1.5rem,calc(1rem+env(safe-area-inset-bottom)))]',
                )}
                {...props}
            />
        );
    }
    return <SheetFooter className={className} {...props} />;
}

function FormPanelTitle({ className, ...props }: React.ComponentProps<typeof SheetTitle>) {
    const variant = useFormPanelVariant();
    if (variant === 'drawer') {
        return <DrawerTitle className={className} {...props} />;
    }
    return <SheetTitle className={className} {...props} />;
}

function FormPanelDescription({ className, ...props }: React.ComponentProps<typeof SheetDescription>) {
    const variant = useFormPanelVariant();
    if (variant === 'drawer') {
        return <DrawerDescription className={className} {...props} />;
    }
    return <SheetDescription className={className} {...props} />;
}

export const formPanelSheetBase = 'flex w-full flex-col gap-0 p-0';
export const formPanelSheetWide = `${formPanelSheetBase} md:max-w-[1200px]`;
export const formPanelSheetDefault = `${formPanelSheetBase} sm:max-w-md`;
export const formPanelSheetFormOnly = `${formPanelSheetBase} sm:max-w-2xl`;

export { FormPanel, FormPanelHeader, FormPanelFooter, FormPanelTitle, FormPanelDescription };
