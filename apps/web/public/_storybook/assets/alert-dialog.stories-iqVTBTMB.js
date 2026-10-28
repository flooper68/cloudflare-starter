import{X as c,j as e,Y as h,Z as D,B as l,_ as C,$ as j,a0 as A,a1 as x,a2 as v,a3 as y,a4 as b,r as d,a5 as T,C as w,e as O,f as N,m as k}from"./iframe-BjN4PNZi.js";import{A as H}from"./archive-vpGSa4fK.js";import{T as p}from"./trash-D4pgkLAF.js";import"./preload-helper-PPVm8Dsz.js";const z={title:"Overlays/AlertDialog",component:c,tags:["autodocs"],args:{open:!1,title:"Delete project?",description:"“Mobile app v2” and its 48 issues will be deleted for everyone. This can’t be undone.",confirmLabel:"Delete project",cancelLabel:"Cancel",tone:"danger",onOpenChange:()=>{},onConfirm:()=>{}},argTypes:{tone:{control:"inline-radio",options:["default","danger"]}},parameters:{docs:{description:{component:"A modal that requires an answer: it does not close on outside click, and focus starts on\nCancel. Use it only for destructive or irreversible actions. `useConfirm()` gives a\npromise-based `confirm()` for the common case; `ConfirmDialog` is the same thing as a\ncontrolled component."}}}},m={docs:{story:{inline:!1,iframeHeight:360}}},a={render:function(s){const[i,o]=d.useState(!1);return e.jsxs(e.Fragment,{children:[e.jsx(l,{variant:"danger",icon:e.jsx(p,{}),onClick:()=>o(!0),children:"Delete project"}),e.jsx(c,{...s,open:i,onOpenChange:o,onConfirm:s.onConfirm})]})}},n={parameters:m,args:{open:!0}},r={parameters:m,render:()=>e.jsxs(h,{defaultOpen:!0,children:[e.jsx(D,{asChild:!0,children:e.jsx(l,{icon:e.jsx(H,{}),children:"Archive cycle"})}),e.jsxs(C,{children:[e.jsxs(j,{className:"pr-5",children:[e.jsx(A,{children:"Archive Cycle 42?"}),e.jsx(x,{children:"7 unfinished issues will move to Cycle 43."})]}),e.jsxs(v,{children:[e.jsx(y,{children:"Cancel"}),e.jsx(b,{children:"Archive"})]})]})]})},t={render:function(){const{confirm:s,dialog:i}=T(),[o,g]=d.useState("Nothing deleted yet.");return e.jsxs(w,{className:"w-96",children:[e.jsxs(O,{children:[e.jsx(N,{children:"Danger zone"}),e.jsx(k,{children:"Deleting the project removes its issues, documents and updates."})]}),e.jsxs("div",{className:"mt-4 flex items-center justify-between gap-3",children:[e.jsx("span",{className:"text-xs text-fg-subtle",children:o}),e.jsx(l,{variant:"danger",size:"sm",icon:e.jsx(p,{}),onClick:async()=>{const f=await s({title:"Delete project?",description:"“Mobile app v2” and its 48 issues will be deleted. This can’t be undone.",confirmLabel:"Delete project",tone:"danger"});g(f?"Project deleted.":"Kept the project.")},children:"Delete project"})]}),i]})}},L=["Playground","Open","DefaultTone","UseConfirmHook"];a.parameters={...a.parameters,docs:{...a.parameters?.docs,source:{originalSource:`{
  render: function Render(args) {
    const [open, setOpen] = useState(false);
    return <>
        <Button variant="danger" icon={<Trash2 />} onClick={() => setOpen(true)}>
          Delete project
        </Button>
        <ConfirmDialog {...args} open={open} onOpenChange={setOpen} onConfirm={args.onConfirm} />
      </>;
  }
}`,...a.parameters?.docs?.source}}};n.parameters={...n.parameters,docs:{...n.parameters?.docs,source:{originalSource:`{
  parameters: openInFrame,
  args: {
    open: true
  }
}`,...n.parameters?.docs?.source},description:{story:"Open by default, for the docs page.",...n.parameters?.docs?.description}}};r.parameters={...r.parameters,docs:{...r.parameters?.docs,source:{originalSource:`{
  parameters: openInFrame,
  render: () => <AlertDialog defaultOpen>
      <AlertDialogTrigger asChild>
        <Button icon={<Archive />}>Archive cycle</Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader className="pr-5">
          <AlertDialogTitle>Archive Cycle 42?</AlertDialogTitle>
          <AlertDialogDescription>
            7 unfinished issues will move to Cycle 43.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction>Archive</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
}`,...r.parameters?.docs?.source},description:{story:"Non-destructive confirmation with the primary button.",...r.parameters?.docs?.description}}};t.parameters={...t.parameters,docs:{...t.parameters?.docs,source:{originalSource:`{
  render: function Render() {
    const {
      confirm,
      dialog
    } = useConfirm();
    const [result, setResult] = useState<string>("Nothing deleted yet.");
    return <Card className="w-96">
        <CardHeader>
          <CardTitle>Danger zone</CardTitle>
          <CardDescription>
            Deleting the project removes its issues, documents and updates.
          </CardDescription>
        </CardHeader>
        <div className="mt-4 flex items-center justify-between gap-3">
          <span className="text-xs text-fg-subtle">{result}</span>
          <Button variant="danger" size="sm" icon={<Trash2 />} onClick={async () => {
          const ok = await confirm({
            title: "Delete project?",
            description: "“Mobile app v2” and its 48 issues will be deleted. This can’t be undone.",
            confirmLabel: "Delete project",
            tone: "danger"
          });
          setResult(ok ? "Project deleted." : "Kept the project.");
        }}>
            Delete project
          </Button>
        </div>
        {dialog}
      </Card>;
  }
}`,...t.parameters?.docs?.source},description:{story:"`useConfirm()` in a settings card: `await confirm({...})` resolves to true or false.",...t.parameters?.docs?.description}}};export{r as DefaultTone,n as Open,a as Playground,t as UseConfirmHook,L as __namedExportsOrder,z as default};
