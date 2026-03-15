# AssignmentCheck2 Agent Rules

- 完成任何代码修改后，最终回复必须附带一个可直接复制的 git commit message，并放在代码块内。
- commit message 使用单行 `type: summary` 格式，默认优先 `fix:`，主体使用简体中文书写，直接描述本次改动的核心结果。
- 执行终端命令时，优先选择当前环境下最稳定、最不容易失败的方法，不为简短牺牲成功率。
- 当前仓库环境以 `bash`、WSL2、Python 3.12、Node 22、Git、`rg` 可用为前提；搜索优先 `rg`，读取优先 `sed`、`nl`、`awk`，静态服务优先 `python3 -m http.server`。
- 如果命令可能受沙箱、端口绑定、代理、缺少依赖或交互式 TTY 影响，先改用更稳妥的非交互方案；确有必要时再申请提权。
- 修改规则内容时保持精简，只保留会直接影响当前仓库协作效率的约束。
