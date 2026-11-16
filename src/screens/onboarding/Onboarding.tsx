import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Sparkles } from "lucide-react";
import { Entry } from "./Entry";
import { NewProfile } from "./NewProfile";
import { ImportFlow } from "./ImportFlow";
import { PostImportNotice } from "./PostImportNotice";
import { NewListWizard } from "./NewListWizard";
import { Button } from "@/components/common";
import { useStore } from "@/store/useStore";
import * as ipc from "@/lib/ipc";

type Step = "entry" | "profile" | "firstlist" | "import" | "postimport";

export function Onboarding() {
  const boot = useStore((s) => s.boot);
  const createList = useStore((s) => s.createList);
  const [step, setStep] = useState<Step>("entry");

  const finish = async () => {
    await ipc.completeOnboarding();
    await boot();
  };

  const finishImport = async () => {
    // Imported data already carries its onboarded flag; just reload.
    await boot();
  };

  return (
    <div className="flex h-full items-center justify-center bg-bg px-6">
      <AnimatePresence mode="wait">
        {step === "entry" && (
          <Entry
            key="entry"
            onNew={() => setStep("profile")}
            onImport={() => setStep("import")}
          />
        )}

        {step === "profile" && (
          <NewProfile
            key="profile"
            onBack={() => setStep("entry")}
            onDone={() => setStep("firstlist")}
          />
        )}

        {step === "firstlist" && (
          <motion.div
            key="firstlist"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full max-w-md text-center"
          >
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-accent text-accent-fg">
              <Sparkles className="h-6 w-6" />
            </div>
            <h1 className="text-xl font-semibold">Create your first list</h1>
            <p className="mt-1.5 text-sm text-fg-subtle">
              Lists keep related tasks together. Give the assistant some context and it'll help
              you manage them.
            </p>
            <NewListWizard open onClose={() => {}} onCreated={finish} />
            <Button
              variant="ghost"
              className="mt-5"
              onClick={async () => {
                await createList("My Tasks");
                await finish();
              }}
            >
              Skip — just create “My Tasks”
            </Button>
          </motion.div>
        )}

        {step === "import" && (
          <ImportFlow
            key="import"
            onBack={() => setStep("entry")}
            onImported={() => setStep("postimport")}
          />
        )}

        {step === "postimport" && (
          <PostImportNotice key="postimport" onFinish={finishImport} />
        )}
      </AnimatePresence>
    </div>
  );
}
