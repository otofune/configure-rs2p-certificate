Gehirn RS2 Plus に certbot を置いて Let's encrypt の証明書を自動更新する
===

当初の目的を果したメモです

certbot を入れる前に: Python 3 環境を作る
---
certbot は python で書かれている。
RS2 Plus のデフォルト python は現時点で Python 2 で、既にサポートが終了している。

ので、pyenv を導入してしまう。

- https://github.com/pyenv/pyenv

とりあえず導入するには、こんな感じで実行するとよい。

```zsh
git clone https://github.com/yyuu/pyenv.git ~/.pyenv
echo >> ~/.zshenv
echo 'export PYENV_ROOT="$HOME/.pyenv"' >> ~/.zshenv
echo 'export PATH="$PYENV_ROOT/bin:$PATH"' >> ~/.zshenv
echo 'eval "$(pyenv init -)"' >> ~/.zshenv
```

これでシェルを再起動すると pyenv が使えるようになる。

Python 3 のインストールは次のように行うとできる。
インストールできるバージョンは `pyenv install --list` でわかるので、その内で最新のものをえらぶ。執筆時点では `3.8.1` だったので次のようにした。

```zsh
# 時間がかかる、実測 156s
pyenv install 3.8.1
pyenv global 3.8.1
```

これでシェルを再起動すれば `python -V` が 3.8.1 になっているはずだ。

```zsh
~ $ pyenv versions
  system
* 3.8.1 (set by /home/otofune/.pyenv/version)
~ $ python -V
Python 3.8.1
~ $ pip -V
pip 19.2.3 from /home/otofune/.pyenv/versions/3.8.1/lib/python3.8/site-packages/pip (python 3.8)
```

certbot を入れる
---
root 権限はないのでパッケージマネージャは使えない。
が、certbot は pip にアップロードされているのでこれを使う。

```
pip install certbot
```

普通の pip なら root 権限がないと書きこめない箇所に書きこみにいって権限エラーが出るが、この pip は pyenv の pip なので `--user` オプションがなくても動く。

これで pyenv の bin に certbot が入り、PATH は既に通してあるため起動するようになる。
ただ、起動はするがデフォルトのディレクトリが root 権限が必要な場所になっているためエラーが出て使えない。
変更するオプションは certbot が提供しているので、変更してやるとよい。

次のような alias を貼ってしまおう。

```sh
alias certbot="certbot \
    --config-dir $HOME/certificates \
    --logs-dir $HOME/certbot-logs \
    --work-dir /tmp"
```

alias は `.zshenv` に書いておくとシェル起動時に読み込まれて便利である。

ところで、`.zshrc` でなく `.zshenv` に書いていることに気付いたかもしれない。これは `.zshrc` はインタラクティブシェルでしか呼ばれないからで、後述の cron で呼ぶときにも使うためである。これまでの pyenv 導入でも同様の理由で `.zshrc` を使っている。

証明書を取得する
---
証明書の取得は DNS を使うと HTTP で待ちうけなくていいので楽だ、というわけでもなくて Gehirn RS2 Plus なら HTTP は待ち受けているだろうから HTTP を使うほうが楽な場合が多いだろうと思う。
場合によるが、ここでは HTTP でやっていく。webroot をつかう。

デフォルトでは /var/www/ドメイン名 になるはずだから、そのディレクトリ名を使って次のように書ける。

```sh
DOMAIN='example.com'
certbot certonly \
    --webroot \
    --webroot-path /var/www/$DOMAIN \
    --domain $DOMAIN
```

これで証明書が取得できる。`$HOME/certificates/live/$DOMAIN` に保存されるはず。

証明書を設定する
---
これについては [README](../README.md) を参照されたい。
特に `CERTBOT_DIRECTORY` に `$HOME/certificates` を指定すればよい

更新する
---

次の手順を踏むだけでできる

```zsh
certbot renew
cd configure-rs2p-certificate
export= # 環境変数をセットする
npm run start
```

自動更新する
---

上の手順を全部シェルスクリプトにしてしまって cron から起動するとよい。

スクリプトはこんな感じ:

```zsh
#!/usr/bin/zsh
certbot renew
cd $HOME/configure-rs2p-certificate
export GEHIRN_API_AUTHORIZE="Basic APIUSER-APIKEY"
export GEHIRN_CONTAINER_LABEL="watakushimeno-project"
export CERTBOT_DIRECTORY="$HOME/certificates"
export SITE_DOMAIN="example.com"
npm run start
```

設定するドメインが複数ある場合には、現時点では `SITE_DOMAIN` 環境変数を再設定して再度 npm run start する必要がある。

例えば

```zsh
...
export SITE_DOMAIN="example.com"
npm run start
export SITE_DOMAIN="example2.com"
npm run start
export SITE_DOMAIN="example3.com"
npm run start
```

といったようになる。

このスクリプトを適当な名前で保存して `crontab -e` に追記すると完成。

例:

```
# 毎月15日に実行する
0 0 15 * *  $HOME/update-certificate.sh
```

まとめ
---
- root 権限がなくても certbot は動く
